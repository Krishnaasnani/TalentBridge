import assert from "node:assert/strict";
import test from "node:test";
import { analyzeJobMatch, analyzeResume } from "../controllers/resumeController.js";
import cloudinary from "../config/cloudinary.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import User from "../models/User.js";

const candidateId = "507f1f77bcf86cd799439011";
const resumeUrl = "https://res.cloudinary.com/demo/raw/upload/v1/resumes/candidate.pdf";

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const candidateRequest = (body = {}) => ({ user: { id: candidateId, role: "candidate" }, body });
const originals = {
  userFindById: User.findById,
  analysisFindOne: ResumeAnalysis.findOne,
  privateDownloadUrl: cloudinary.utils.private_download_url,
  fetch: globalThis.fetch,
};

test.afterEach(() => {
  User.findById = originals.userFindById;
  ResumeAnalysis.findOne = originals.analysisFindOne;
  cloudinary.utils.private_download_url = originals.privateDownloadUrl;
  globalThis.fetch = originals.fetch;
});

test("AI resume endpoints reject non-candidates", async () => {
  for (const handler of [analyzeResume, analyzeJobMatch]) {
    const res = response();
    await handler({ user: { id: candidateId, role: "employer" }, body: { jobDescription: "Backend role" } }, res);
    assert.equal(res.statusCode, 403);
  }
});

test("AI resume endpoints reject missing and unsupported resumes", async () => {
  for (const handler of [analyzeResume, analyzeJobMatch]) {
    User.findById = () => ({ select: async () => ({ resume: "" }) });
    const missing = response();
    await handler(candidateRequest({ jobDescription: "Backend role" }), missing);
    assert.equal(missing.statusCode, 400);

    User.findById = () => ({ select: async () => ({ resume: "https://storage.test/resume.txt" }) });
    const unsupported = response();
    await handler(candidateRequest({ jobDescription: "Backend role" }), unsupported);
    assert.equal(unsupported.statusCode, 415);
  }
});

test("AI resume endpoints hide upstream failures and reject malformed AI responses", async () => {
  User.findById = () => ({ select: async () => ({ resume: resumeUrl }) });
  cloudinary.utils.private_download_url = () => "https://storage.test/resume.pdf";
  ResumeAnalysis.findOne = async () => null;

  for (const handler of [analyzeResume, analyzeJobMatch]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: true, headers: { get: () => "application/pdf" }, arrayBuffer: async () => new TextEncoder().encode("resume").buffer };
      }
      throw new Error("AI service credential failure");
    };
    const unavailable = response();
    await handler(candidateRequest({ jobDescription: "Backend role" }), unavailable);
    assert.equal(unavailable.statusCode, 503);
    assert.equal(JSON.stringify(unavailable.body).includes("credential failure"), false);

    calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: true, headers: { get: () => "application/pdf" }, arrayBuffer: async () => new TextEncoder().encode("resume").buffer };
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };
    const malformed = response();
    await handler(candidateRequest({ jobDescription: "Backend role" }), malformed);
    assert.equal(malformed.statusCode, 502);
    assert.equal(JSON.stringify(malformed.body).includes("credential failure"), false);
  }
});
