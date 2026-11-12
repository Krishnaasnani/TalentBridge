import assert from "node:assert/strict";
import test from "node:test";
import { getMyResume, getProfile, updateProfile } from "../controllers/userController.js";
import cloudinary from "../config/cloudinary.js";
import User from "../models/User.js";
import upload from "../middleware/uploadMiddleware.js";
import userRoutes from "../routes/userRoutes.js";

const candidateId = "507f1f77bcf86cd799439011";

const response = () => {
  const result = { statusCode: null, body: null, headers: {}, sent: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  result.set = (name, value) => { result.headers[name] = value; return result; };
  result.send = (body) => { result.sent = body; return result; };
  return result;
};

const originals = {
  findById: User.findById,
  findByIdAndUpdate: User.findByIdAndUpdate,
  privateDownloadUrl: cloudinary.utils.private_download_url,
  fetch: globalThis.fetch,
  uploadSingle: upload.single,
};

test.afterEach(() => {
  User.findById = originals.findById;
  User.findByIdAndUpdate = originals.findByIdAndUpdate;
  cloudinary.utils.private_download_url = originals.privateDownloadUrl;
  globalThis.fetch = originals.fetch;
  upload.single = originals.uploadSingle;
});

test("profile retrieval returns the authenticated user's safe profile response", async () => {
  const profile = { _id: candidateId, fullName: "Ada", email: "ada@example.test", skills: ["React"] };
  let requestedId;
  User.findById = async (id) => { requestedId = id; return profile; };
  const res = response();

  await getProfile({ user: { id: candidateId, role: "candidate" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(requestedId, candidateId);
  assert.deepEqual(res.body, { success: true, user: profile });
  assert.equal("password" in res.body.user, false);
});

test("profile-upload middleware returns safe file-size, validation, and storage errors", async () => {
  const uploadHandler = userRoutes.stack
    .find((layer) => layer.route?.path === "/profile" && layer.route.methods.put)
    .route.stack[1].handle;

  for (const [error, status, message] of [
    [Object.assign(new Error("too large"), { code: "LIMIT_FILE_SIZE" }), 400, "Resume must be 10 MB or smaller."],
    [Object.assign(new Error("Only PDF files are allowed."), { statusCode: 400 }), 400, "Only PDF files are allowed."],
    [new Error("storage credentials failed"), 502, "Unable to upload the resume. Please try again."],
  ]) {
    upload.single = () => (_req, _res, next) => next(error);
    const res = response();
    await uploadHandler({}, res, () => assert.fail("profile controller must not run after an upload error"));
    assert.equal(res.statusCode, status);
    assert.equal(res.body.message, message);
    assert.equal(JSON.stringify(res.body).includes("storage credentials failed"), false);
  }
});

test("profile updates are scoped to the authenticated user and permit only supported fields", async () => {
  let updatedId;
  let update;
  User.findByIdAndUpdate = async (id, changes) => {
    updatedId = id;
    update = changes;
    return { _id: id, fullName: changes.$set.fullName, skills: changes.$set.skills };
  };
  const res = response();

  await updateProfile({
    user: { id: candidateId, role: "candidate" },
    body: { fullName: " Ada ", skills: '["React", "Node"]', role: "admin", id: "another-user" },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updatedId, candidateId);
  assert.deepEqual(update, { $set: { fullName: "Ada", skills: ["React", "Node"] } });
  assert.equal("role" in update.$set, false);
  assert.equal("id" in update.$set, false);
});

test("candidate resume retrieval rejects non-candidates, missing resumes, and unsupported formats", async () => {
  const employer = response();
  await getMyResume({ user: { id: candidateId, role: "employer" } }, employer);
  assert.equal(employer.statusCode, 403);

  User.findById = () => ({ select: async () => null });
  const missing = response();
  await getMyResume({ user: { id: candidateId, role: "candidate" } }, missing);
  assert.equal(missing.statusCode, 404);

  User.findById = () => ({ select: async () => ({ resume: "https://storage.test/resumes/resume.txt" }) });
  const unsupported = response();
  await getMyResume({ user: { id: candidateId, role: "candidate" } }, unsupported);
  assert.equal(unsupported.statusCode, 404);
  assert.equal(unsupported.body.message, "Resume not available.");
});

test("candidate resume retrieval proxies a valid resume and hides upstream errors", async () => {
  User.findById = () => ({ select: async () => ({ resume: "https://res.cloudinary.com/demo/raw/upload/v1/resumes/candidate.pdf" }) });
  cloudinary.utils.private_download_url = () => "https://storage.test/resume.pdf";
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: (name) => name === "content-type" ? "application/pdf" : null },
    arrayBuffer: async () => new TextEncoder().encode("resume bytes").buffer,
  });
  const valid = response();
  await getMyResume({ user: { id: candidateId, role: "candidate" } }, valid);
  assert.equal(valid.headers["Content-Type"], "application/pdf");
  assert.equal(Buffer.from(valid.sent).toString(), "resume bytes");

  globalThis.fetch = async () => ({ ok: false, statusText: "storage credentials failed" });
  const failed = response();
  await getMyResume({ user: { id: candidateId, role: "candidate" } }, failed);
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.body.message, "Unable to retrieve the resume.");
  assert.equal(JSON.stringify(failed.body).includes("storage credentials failed"), false);
});
