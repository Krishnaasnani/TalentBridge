import assert from "node:assert/strict";
import test from "node:test";
import { getEmployerApplicationSummary } from "../controllers/applicationController.js";
import { getAdminStats } from "../controllers/adminController.js";
import { adminOnly } from "../middleware/authMiddleware.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";

const employerId = "507f1f77bcf86cd799439011";
const ownJobId = "507f1f77bcf86cd799439012";
const secondOwnJobId = "507f1f77bcf86cd799439013";
const otherJobId = "507f1f77bcf86cd799439014";

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const originals = {
  applicationCountDocuments: Application.countDocuments,
  jobFind: Job.find,
  jobCountDocuments: Job.countDocuments,
  userCountDocuments: User.countDocuments,
};

test.afterEach(() => {
  Application.countDocuments = originals.applicationCountDocuments;
  Job.find = originals.jobFind;
  Job.countDocuments = originals.jobCountDocuments;
  User.countDocuments = originals.userCountDocuments;
});

test("employer analytics counts only applications for the employer's own jobs", async () => {
  Job.find = (filter) => {
    assert.deepEqual(filter, { createdBy: employerId });
    return { select: async () => [{ _id: ownJobId }, { _id: secondOwnJobId }] };
  };

  const seenFilters = [];
  Application.countDocuments = async (filter) => {
    seenFilters.push(filter);
    assert.deepEqual(filter.job.$in, [ownJobId, secondOwnJobId]);
    if (!filter.status) return 3;
    return { pending: 1, accepted: 1, rejected: 1 }[filter.status];
  };

  const res = response();
  await getEmployerApplicationSummary({ user: { id: employerId, role: "employer" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    totalJobs: 2,
    totalApplications: 3,
    pendingApplications: 1,
    acceptedApplications: 1,
    rejectedApplications: 1,
  });
  assert.equal(seenFilters.length, 4);
  assert.equal(seenFilters.some((filter) => filter.job.$in.includes(otherJobId)), false);
});

test("employer analytics returns zero counts when the employer has no jobs", async () => {
  Job.find = () => ({ select: async () => [] });
  Application.countDocuments = async (filter) => {
    assert.deepEqual(filter.job.$in, []);
    return 0;
  };

  const res = response();
  await getEmployerApplicationSummary({ user: { id: employerId, role: "employer" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.totalJobs, 0);
  assert.equal(res.body.totalApplications, 0);
  assert.equal(res.body.pendingApplications, 0);
  assert.equal(res.body.acceptedApplications, 0);
  assert.equal(res.body.rejectedApplications, 0);
});

test("admin analytics returns role and application-status counts", async () => {
  User.countDocuments = async (filter = {}) => ({
    "{}": 10,
    '{"role":"candidate"}': 6,
    '{"role":"employer"}': 3,
  })[JSON.stringify(filter)] ?? 0;
  Job.countDocuments = async () => 4;
  Application.countDocuments = async (filter = {}) => ({
    "{}": 7,
    '{"status":"pending"}': 3,
    '{"status":"accepted"}': 2,
    '{"status":"rejected"}': 2,
  })[JSON.stringify(filter)] ?? 0;

  const res = response();
  await getAdminStats({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, {
    totalUsers: 10,
    candidates: 6,
    employers: 3,
    totalJobs: 4,
    totalApplications: 7,
    pendingApplications: 3,
    acceptedApplications: 2,
    rejectedApplications: 2,
  });
});

test("admin authorization denies candidates and employers before analytics controllers run", () => {
  for (const role of ["candidate", "employer"]) {
    const res = response();
    let continued = false;
    adminOnly({ user: { role } }, res, () => { continued = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(continued, false);
  }
});
