import assert from "node:assert/strict";
import test from "node:test";
import { getApplicationResume, getJobApplicants } from "../controllers/applicationController.js";
import cloudinary from "../config/cloudinary.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";

const employerId = "507f1f77bcf86cd799439011";
const otherEmployerId = "507f1f77bcf86cd799439012";
const jobId = "507f1f77bcf86cd799439013";
const applicantId = "507f1f77bcf86cd799439014";
const response = () => {
  const result = { statusCode: null, body: null, headers: {}, sent: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  result.set = (name, value) => { result.headers[name] = value; return result; };
  result.send = (body) => { result.sent = body; return result; };
  return result;
};
const request = (query = {}, role = "employer", id = employerId) => ({ user: { id, role }, params: { jobId }, query });
const originals = { jobFindById: Job.findById, userFind: User.find, applicationFind: Application.find, applicationFindById: Application.findById, countDocuments: Application.countDocuments, privateDownloadUrl: cloudinary.utils.private_download_url, fetch: globalThis.fetch };

test.afterEach(() => {
  Job.findById = originals.jobFindById;
  User.find = originals.userFind;
  Application.find = originals.applicationFind;
  Application.findById = originals.applicationFindById;
  Application.countDocuments = originals.countDocuments;
  cloudinary.utils.private_download_url = originals.privateDownloadUrl;
  globalThis.fetch = originals.fetch;
});

const ownJob = () => { Job.findById = () => ({ select: async () => ({ _id: jobId, title: "Frontend Engineer", createdBy: { toString: () => employerId } }) }); };
const applicationQuery = (application) => ({
  populate() { return this; },
  then(resolve, reject) { return Promise.resolve(application).then(resolve, reject); },
});
const mockApplicantResults = () => {
  User.find = () => ({ select: async () => [{ _id: applicantId }] });
  Application.countDocuments = async () => 1;
  Application.find = () => ({
    populate() { return this; }, sort() { return this; }, skip() { return this; },
    limit: async () => [{ _id: "507f1f77bcf86cd799439015", status: "accepted", createdAt: new Date(), applicant: { _id: applicantId, fullName: "Ada React", email: "ada@example.com", skills: ["React"], resume: "https://private.example/resume.pdf", password: "never-return" } }],
  });
};

test("employer retrieves their applicants with safe fields and pagination", async () => {
  ownJob(); mockApplicantResults();
  const res = response();
  await getJobApplicants(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pagination.total, 1);
  assert.equal(res.body.applications[0].applicant.fullName, "Ada React");
  assert.equal(res.body.applications[0].hasResume, true);
  assert.equal("resume" in res.body.applications[0].applicant, false);
  assert.equal("password" in res.body.applications[0].applicant, false);
});

test("rejects non-owners and non-employer roles before returning applicants", async () => {
  ownJob();
  const candidate = response();
  await getJobApplicants(request({}, "candidate"), candidate);
  assert.equal(candidate.statusCode, 403);
  const admin = response();
  await getJobApplicants(request({}, "admin"), admin);
  assert.equal(admin.statusCode, 403);
  const otherEmployer = response();
  await getJobApplicants(request({}, "employer", otherEmployerId), otherEmployer);
  assert.equal(otherEmployer.statusCode, 403);
});

test("applicant lookup rejects malformed and nonexistent job IDs", async () => {
  const malformed = response();
  await getJobApplicants({ ...request(), params: { jobId: "not-an-id" } }, malformed);
  assert.equal(malformed.statusCode, 404);

  Job.findById = () => ({ select: async () => null });
  const nonexistent = response();
  await getJobApplicants(request(), nonexistent);
  assert.equal(nonexistent.statusCode, 404);
});

test("applicant resume retrieval requires an employer who owns the job", async () => {
  const candidate = response();
  await getApplicationResume({ user: { id: applicantId, role: "candidate" }, params: { applicationId: "507f1f77bcf86cd799439015" } }, candidate);
  assert.equal(candidate.statusCode, 403);

  const application = { job: { createdBy: { toString: () => employerId } }, applicant: {} };
  Application.findById = () => applicationQuery(application);

  const otherEmployer = response();
  await getApplicationResume({ user: { id: otherEmployerId, role: "employer" }, params: { applicationId: "507f1f77bcf86cd799439015" } }, otherEmployer);
  assert.equal(otherEmployer.statusCode, 403);

  const owner = response();
  await getApplicationResume({ user: { id: employerId, role: "employer" }, params: { applicationId: "507f1f77bcf86cd799439015" } }, owner);
  assert.equal(owner.statusCode, 404);
  assert.equal(owner.body.message, "Resume not available");
});

test("applicant resume retrieval proxies an owned resume", async () => {
  const application = {
    job: { createdBy: { toString: () => employerId } },
    applicant: { resume: "https://res.cloudinary.com/demo/raw/upload/v1/resumes/candidate.pdf" },
  };
  Application.findById = () => applicationQuery(application);
  cloudinary.utils.private_download_url = () => "https://storage.test/resume.pdf";
  globalThis.fetch = async (url) => {
    assert.equal(url, "https://storage.test/resume.pdf");
    return {
      ok: true,
      headers: { get: (name) => name === "content-type" ? "application/pdf" : null },
      arrayBuffer: async () => new TextEncoder().encode("resume bytes").buffer,
    };
  };
  const res = response();

  await getApplicationResume({ user: { id: employerId, role: "employer" }, params: { applicationId: "507f1f77bcf86cd799439015" } }, res);

  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.equal(res.headers["Content-Disposition"], "inline");
  assert.equal(Buffer.from(res.sent).toString(), "resume bytes");
});

test("applicant resume retrieval hides upstream download failures", async () => {
  const application = {
    job: { createdBy: { toString: () => employerId } },
    applicant: { resume: "https://res.cloudinary.com/demo/raw/upload/v1/resumes/candidate.pdf" },
  };
  Application.findById = () => applicationQuery(application);
  cloudinary.utils.private_download_url = () => "https://storage.test/resume.pdf";
  globalThis.fetch = async () => ({ ok: false, statusText: "storage credentials failed" });
  const res = response();

  await getApplicationResume({ user: { id: employerId, role: "employer" }, params: { applicationId: "507f1f77bcf86cd799439015" } }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.message, "Unable to retrieve the resume");
  assert.equal("error" in res.body, false);
  assert.equal(JSON.stringify(res.body).includes("storage credentials failed"), false);
});

test("applicant resume retrieval hides network exceptions", async () => {
  const application = {
    job: { createdBy: { toString: () => employerId } },
    applicant: { resume: "https://res.cloudinary.com/demo/raw/upload/v1/resumes/candidate.pdf" },
  };
  Application.findById = () => applicationQuery(application);
  cloudinary.utils.private_download_url = () => "https://storage.test/resume.pdf";
  globalThis.fetch = async () => { throw new Error("network credentials unavailable"); };
  const res = response();

  await getApplicationResume({ user: { id: employerId, role: "employer" }, params: { applicationId: "507f1f77bcf86cd799439015" } }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.message, "Unable to retrieve the resume");
  assert.equal("error" in res.body, false);
  assert.equal(JSON.stringify(res.body).includes("network credentials unavailable"), false);
});

test("builds escaped name/email search, status, and skills filters using stored values", async () => {
  ownJob(); mockApplicantResults();
  let userFilter;
  let applicationFilter;
  User.find = (filter) => { userFilter = filter; return { select: async () => [{ _id: applicantId }] }; };
  Application.countDocuments = async (filter) => { applicationFilter = filter; return 1; };
  const res = response();
  await getJobApplicants(request({ search: "Ada.*", skills: "React", status: "accepted", page: "2", limit: "5" }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(userFilter.role, "candidate");
  assert.equal(userFilter.skills.$regex, "React");
  assert.equal(userFilter.$or[0].fullName.$regex, "Ada\\.\\*");
  assert.equal(applicationFilter.status, "accepted");
  assert.deepEqual(applicationFilter.applicant.$in, [applicantId]);
  assert.equal(res.body.pagination.page, 2);
});

test("rejects invalid status and pagination input", async () => {
  ownJob();
  for (const query of [{ status: "shortlisted" }, { page: "zero" }, { page: "0" }, { limit: "51" }]) {
    const res = response();
    await getJobApplicants(request(query), res);
    assert.equal(res.statusCode, 400);
  }
});
