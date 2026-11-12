import assert from "node:assert/strict";
import test from "node:test";
import { getJobById } from "../controllers/jobController.js";
import Job from "../models/Job.js";

const jobId = "507f1f77bcf86cd799439011";

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const originalFindById = Job.findById;

test.afterEach(() => {
  Job.findById = originalFindById;
});

test("a visible public job detail includes its populated public company fields", async () => {
  let requestedId;
  let companyFields;
  const job = {
    _id: jobId,
    title: "Backend Engineer",
    description: "Build reliable APIs.",
    requirements: ["Node.js"],
    location: "Pune",
    jobType: "Full-time",
    experienceLevel: "Fresher",
    company: { _id: "company-id", name: "Acme", description: "Engineering company", website: "https://acme.test", location: "Pune", logo: "https://acme.test/logo.png" },
    moderationStatus: "active",
  };
  Job.findById = (id) => {
    requestedId = id;
    return { populate: async (_path, fields) => { companyFields = fields; return job; } };
  };
  const res = response();

  await getJobById({ params: { id: jobId } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(requestedId, jobId);
  assert.equal(companyFields, "name description website location logo");
  assert.deepEqual(res.body, { success: true, job });
  assert.equal("password" in res.body.job.company, false);
  assert.equal("createdBy" in res.body.job.company, false);
});

test("a missing public job detail follows the established not-found behavior", async () => {
  Job.findById = () => ({ populate: async () => null });
  const res = response();

  await getJobById({ params: { id: jobId } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Job not found");
});

test("job-detail database failures return a generic response without internal details", async () => {
  Job.findById = () => ({ populate: async () => { throw new Error("database connection details"); } });
  const res = response();

  await getJobById({ params: { id: jobId } }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "Server Error");
  assert.equal(JSON.stringify(res.body).includes("database connection details"), false);
});
