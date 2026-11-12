import assert from "node:assert/strict";
import test from "node:test";
import { createJob, deleteJob, updateJob } from "../controllers/jobController.js";
import Job from "../models/Job.js";
import { protect } from "../middleware/authMiddleware.js";

const employerId = "507f1f77bcf86cd799439011";
const otherEmployerId = "507f1f77bcf86cd799439013";
const jobId = "507f1f77bcf86cd799439012";

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

test("job edits reject invalid values without saving a partial job", async () => {
  let saves = 0;
  const job = {
    createdBy: { toString: () => employerId },
    title: "Backend Engineer",
    save: async () => { saves += 1; },
  };
  Job.findById = async () => job;

  for (const body of [
    { title: "   " },
    { description: 12 },
    { requirements: [] },
    { jobType: "Contract" },
  ]) {
    const res = response();
    await updateJob({ user: { id: employerId, role: "employer" }, params: { id: jobId }, body }, res);
    assert.equal(res.statusCode, 400);
  }

  assert.equal(job.title, "Backend Engineer");
  assert.equal(saves, 0);
});

test("an employer can update their own valid job", async () => {
  let saves = 0;
  const job = {
    createdBy: { toString: () => employerId },
    title: "Backend Engineer",
    description: "Old description",
    requirements: ["Node.js"],
    salary: null,
    location: "Pune",
    experienceLevel: "Fresher",
    jobType: "Full-time",
    save: async () => { saves += 1; },
  };
  Job.findById = async () => job;
  const res = response();

  await updateJob({
    user: { id: employerId, role: "employer" },
    params: { id: jobId },
    body: {
      title: " Senior Backend Engineer ",
      description: "Build reliable APIs.",
      requirements: [" Node.js ", "PostgreSQL"],
      salary: " ₹12L ",
      location: " Remote ",
      experienceLevel: " 3 years ",
      jobType: "Remote",
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(job.title, "Senior Backend Engineer");
  assert.deepEqual(job.requirements, ["Node.js", "PostgreSQL"]);
  assert.equal(job.jobType, "Remote");
  assert.equal(saves, 1);
});

test("only an owning employer can update a job", async () => {
  const job = { createdBy: { toString: () => employerId }, save: async () => assert.fail("must not save") };
  Job.findById = async () => job;

  const wrongRole = response();
  await updateJob({ user: { id: employerId, role: "candidate" }, params: { id: jobId }, body: { title: "New title" } }, wrongRole);
  assert.equal(wrongRole.statusCode, 403);

  const otherEmployer = response();
  await updateJob({ user: { id: otherEmployerId, role: "employer" }, params: { id: jobId }, body: { title: "New title" } }, otherEmployer);
  assert.equal(otherEmployer.statusCode, 403);
});

test("non-employers cannot create jobs", async () => {
  const res = response();

  await createJob({ user: { id: employerId, role: "candidate" }, body: {} }, res);

  assert.equal(res.statusCode, 403);
});

test("job creation rejects malformed string fields before database access", async () => {
  for (const body of [
    { title: 12, description: "Description", companyName: "Acme", location: "Pune", experienceLevel: "Fresher", jobType: "Full-time", requirements: ["Node.js"] },
    { title: "Developer", description: null, companyName: "Acme", location: "Pune", experienceLevel: "Fresher", jobType: "Full-time", requirements: ["Node.js"] },
    { title: "Developer", description: "Description", companyName: {}, location: "Pune", experienceLevel: "Fresher", jobType: "Full-time", requirements: ["Node.js"] },
    { title: "Developer", description: "Description", companyName: "Acme", location: "Pune", experienceLevel: "Fresher", jobType: "Full-time", requirements: [null] },
  ]) {
    const res = response();
    await createJob({ user: { id: employerId, role: "employer" }, body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test("job updates reject malformed salary values without saving", async () => {
  let saves = 0;
  Job.findById = async () => ({ createdBy: { toString: () => employerId }, save: async () => { saves += 1; } });
  const res = response();
  await updateJob({ user: { id: employerId, role: "employer" }, params: { id: jobId }, body: { salary: {} } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(saves, 0);
});

test("an employer cannot delete another employer's job", async () => {
  const job = { createdBy: { toString: () => employerId } };
  Job.findById = async () => job;
  const res = response();

  await deleteJob({ user: { id: otherEmployerId, role: "employer" }, params: { id: jobId } }, res);

  assert.equal(res.statusCode, 403);
});

test("job edits require authentication before reaching the controller", () => {
  const res = response();
  protect({ headers: {} }, res, () => assert.fail("next must not be called"));
  assert.equal(res.statusCode, 401);
});

test("job edits and deletions reject malformed IDs before querying jobs", async () => {
  Job.findById = async () => assert.fail("findById must not be called for a malformed ID");

  const updateRes = response();
  await updateJob({ user: { id: employerId, role: "employer" }, params: { id: "not-an-id" }, body: {} }, updateRes);
  assert.equal(updateRes.statusCode, 400);
  assert.equal(updateRes.body.message, "Invalid job ID");

  const deleteRes = response();
  await deleteJob({ user: { id: employerId, role: "employer" }, params: { id: "not-an-id" } }, deleteRes);
  assert.equal(deleteRes.statusCode, 400);
  assert.equal(deleteRes.body.message, "Invalid job ID");
});

test("job edits and deletions return 404 for missing valid IDs", async () => {
  Job.findById = async () => null;

  const updateRes = response();
  await updateJob({ user: { id: employerId, role: "employer" }, params: { id: jobId }, body: {} }, updateRes);
  assert.equal(updateRes.statusCode, 404);

  const deleteRes = response();
  await deleteJob({ user: { id: employerId, role: "employer" }, params: { id: jobId } }, deleteRes);
  assert.equal(deleteRes.statusCode, 404);
});

test("job-edit failures return a safe API error", async () => {
  Job.findById = async () => { throw new Error("database connection details"); };
  const res = response();

  await updateJob({ user: { id: employerId, role: "employer" }, params: { id: jobId }, body: {} }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "Unable to update job");
  assert.equal("error" in res.body, false);
});

test("job-delete failures return a safe API error", async () => {
  Job.findById = async () => { throw new Error("database connection details"); };
  const res = response();

  await deleteJob({ user: { id: employerId, role: "employer" }, params: { id: jobId } }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "Unable to delete job");
  assert.equal("error" in res.body, false);
  assert.equal(JSON.stringify(res.body).includes("database connection details"), false);
});
