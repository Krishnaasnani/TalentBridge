import assert from "node:assert/strict";
import test from "node:test";
import { moderateAdminJob } from "../controllers/adminController.js";
import { applyJob } from "../controllers/applicationController.js";
import { getAllJobs, getJobById, getJobRecommendations } from "../controllers/jobController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import User from "../models/User.js";

const adminId = "507f1f77bcf86cd799439011";
const candidateId = "507f1f77bcf86cd799439012";
const jobId = "507f1f77bcf86cd799439013";

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const originals = {
  applicationCreate: Application.create,
  applicationFind: Application.find,
  applicationFindOne: Application.findOne,
  jobCountDocuments: Job.countDocuments,
  jobFind: Job.find,
  jobFindById: Job.findById,
  resumeFindOne: ResumeAnalysis.findOne,
  userFindById: User.findById,
};

test.afterEach(() => {
  Application.create = originals.applicationCreate;
  Application.find = originals.applicationFind;
  Application.findOne = originals.applicationFindOne;
  Job.countDocuments = originals.jobCountDocuments;
  Job.find = originals.jobFind;
  Job.findById = originals.jobFindById;
  ResumeAnalysis.findOne = originals.resumeFindOne;
  User.findById = originals.userFindById;
});

test("job moderation requires authentication and an admin role", () => {
  const unauthenticated = response();
  protect({ headers: {} }, unauthenticated, () => assert.fail("next must not run"));
  assert.equal(unauthenticated.statusCode, 401);

  for (const role of ["candidate", "employer"]) {
    const res = response();
    adminOnly({ user: { role } }, res, () => assert.fail("next must not run"));
    assert.equal(res.statusCode, 403);
  }
});

test("job moderation validates ID, status, and reason", async () => {
  for (const paramsAndBody of [
    [{ jobId: "not-an-id" }, { status: "hidden" }],
    [{ jobId }, { status: "deleted" }],
    [{ jobId }, { status: "hidden", reason: "x".repeat(501) }],
    [{ jobId }, { status: "hidden", reason: 42 }],
  ]) {
    const [params, body] = paramsAndBody;
    const res = response();
    await moderateAdminJob({ user: { id: adminId }, params, body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test("job moderation returns 404 for a nonexistent job", async () => {
  Job.findById = async () => null;
  const res = response();
  await moderateAdminJob({ user: { id: adminId }, params: { jobId }, body: { status: "hidden" } }, res);
  assert.equal(res.statusCode, 404);
});

test("an admin can hide and restore a job without changing its applications", async () => {
  let saves = 0;
  const application = {
    status: "accepted",
    statusHistory: [{ status: "pending" }, { status: "accepted" }],
  };
  const applicationSnapshot = structuredClone(application);
  const job = {
    _id: jobId,
    title: "Platform Engineer",
    moderationStatus: "active",
    moderatedAt: null,
    moderatedBy: null,
    moderationReason: "",
    save: async () => { saves += 1; },
  };
  Job.findById = async () => job;

  const hidden = response();
  await moderateAdminJob({ user: { id: adminId }, params: { jobId }, body: { status: "hidden", reason: "Duplicate listing" } }, hidden);
  assert.equal(hidden.statusCode, 200);
  assert.equal(job.moderationStatus, "hidden");
  assert.equal(job.moderatedBy, adminId);
  assert.equal(job.moderationReason, "Duplicate listing");
  assert.equal(saves, 1);

  const repeated = response();
  await moderateAdminJob({ user: { id: adminId }, params: { jobId }, body: { status: "hidden" } }, repeated);
  assert.equal(repeated.statusCode, 200);
  assert.equal(saves, 1);

  const restored = response();
  await moderateAdminJob({ user: { id: adminId }, params: { jobId }, body: { status: "active" } }, restored);
  assert.equal(restored.statusCode, 200);
  assert.equal(job.moderationStatus, "active");
  assert.equal(saves, 2);
  assert.deepEqual(application, applicationSnapshot);
});

test("hidden jobs are excluded from public lists, details, recommendations, and new applications", async () => {
  let publicFilter;
  Job.countDocuments = async (filter) => { publicFilter = filter; return 0; };
  Job.find = () => ({ populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] });
  const list = response();
  await getAllJobs({ query: {} }, list);
  assert.equal(list.statusCode, 200);
  assert.deepEqual(publicFilter.moderationStatus, { $ne: "hidden" });

  const hiddenJob = { _id: jobId, moderationStatus: "hidden" };
  Job.findById = () => ({ populate: async () => hiddenJob });
  const details = response();
  await getJobById({ params: { id: jobId } }, details);
  assert.equal(details.statusCode, 404);

  User.findById = () => ({ select: async () => ({ skills: ["React"] }) });
  let recommendationFilter;
  Job.find = (filter) => { recommendationFilter = filter; return { populate: () => ({ sort: async () => [] }) }; };
  Application.find = () => ({ select: async () => [] });
  const recommendations = response();
  await getJobRecommendations({ user: { id: candidateId, role: "candidate" } }, recommendations);
  assert.equal(recommendations.statusCode, 200);
  assert.deepEqual(recommendationFilter, { moderationStatus: { $ne: "hidden" } });

  Job.findById = async () => hiddenJob;
  Application.findOne = async () => assert.fail("hidden jobs must not reach duplicate checks");
  Application.create = async () => assert.fail("hidden jobs must not receive applications");
  const apply = response();
  await applyJob({ user: { id: candidateId, role: "candidate" }, params: { jobId } }, apply);
  assert.equal(apply.statusCode, 404);
});
