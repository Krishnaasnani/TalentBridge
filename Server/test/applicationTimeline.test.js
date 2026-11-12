import assert from "node:assert/strict";
import test from "node:test";
import { protect } from "../middleware/authMiddleware.js";
import {
  applyJob,
  getMyApplications,
  updateApplicationStatus,
} from "../controllers/applicationController.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";

const candidateId = "507f1f77bcf86cd799439011";
const employerId = "507f1f77bcf86cd799439012";
const otherEmployerId = "507f1f77bcf86cd799439013";
const jobId = "507f1f77bcf86cd799439014";
const applicationId = "507f1f77bcf86cd799439015";
const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};
const originals = {
  applicationCreate: Application.create,
  applicationFind: Application.find,
  applicationFindById: Application.findById,
  applicationFindOne: Application.findOne,
  jobFindById: Job.findById,
};

test.afterEach(() => {
  Application.create = originals.applicationCreate;
  Application.find = originals.applicationFind;
  Application.findById = originals.applicationFindById;
  Application.findOne = originals.applicationFindOne;
  Job.findById = originals.jobFindById;
});

test("protect rejects unauthenticated apply and list application requests", () => {
  for (const req of [
    { headers: {}, params: { jobId } },
    { headers: {}, params: {} },
  ]) {
    const res = response();
    protect(req, res, () => assert.fail("next must not be called"));
    assert.equal(res.statusCode, 401);
  }
});

test("non-candidates cannot view candidate applications", async () => {
  const res = response();

  await getMyApplications({ user: { id: employerId, role: "employer" } }, res);

  assert.equal(res.statusCode, 403);
});

test("application rejects malformed, nonexistent, and hidden jobs", async () => {
  const malformed = response();
  await applyJob({ user: { id: candidateId, role: "candidate" }, params: { jobId: "not-an-object-id" } }, malformed);
  assert.equal(malformed.statusCode, 404);

  Job.findById = async () => null;
  const nonexistent = response();
  await applyJob({ user: { id: candidateId, role: "candidate" }, params: { jobId } }, nonexistent);
  assert.equal(nonexistent.statusCode, 404);

  Job.findById = async () => ({ _id: jobId, moderationStatus: "hidden" });
  const hidden = response();
  await applyJob({ user: { id: candidateId, role: "candidate" }, params: { jobId } }, hidden);
  assert.equal(hidden.statusCode, 404);
});

test("candidate application history is scoped to the authenticated candidate", async () => {
  let query;
  Application.find = (filter) => {
    query = filter;
    return { populate: () => ({ sort: async () => [] }) };
  };
  const res = response();

  await getMyApplications({ user: { id: candidateId, role: "candidate" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(query, { applicant: candidateId });
});

test("duplicate-key application creation errors return conflict", async () => {
  Job.findById = async () => ({ _id: jobId });
  Application.findOne = async () => null;
  Application.create = async () => {
    const error = new Error("duplicate key");
    error.code = 11000;
    throw error;
  };
  const res = response();

  await applyJob({ user: { id: candidateId, role: "candidate" }, params: { jobId } }, res);

  assert.equal(res.statusCode, 409);
});

test("application creation records the initial pending event and keeps duplicate protection", async () => {
  Job.findById = async () => ({ _id: jobId });
  Application.findOne = async () => null;
  let created;
  Application.create = async (input) => { created = { _id: applicationId, ...input }; return created; };
  const res = response();
  await applyJob({ user: { id: candidateId, role: "candidate" }, params: { jobId }, body: { statusHistory: [{ status: "accepted" }] } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(created.status, "pending");
  assert.equal(created.statusHistory.length, 1);
  assert.equal(created.statusHistory[0].status, "pending");
  assert.equal(created.statusHistory[0].actor, candidateId);

  Application.findOne = async () => ({ _id: applicationId });
  const duplicate = response();
  await applyJob({ user: { id: candidateId, role: "candidate" }, params: { jobId } }, duplicate);
  assert.equal(duplicate.statusCode, 409);
});

test("an owner status change appends one history event but repeating it does not", async () => {
  let saves = 0;
  const application = {
    _id: applicationId,
    status: "pending",
    statusHistory: [{ status: "pending", timestamp: new Date(), actor: candidateId }],
    job: { createdBy: { toString: () => employerId } },
    save: async () => { saves += 1; },
  };
  Application.findById = () => ({ populate: async () => application });
  const changed = response();
  await updateApplicationStatus({ user: { id: employerId, role: "employer" }, params: { applicationId }, body: { status: "accepted" } }, changed);
  assert.equal(changed.statusCode, 200);
  assert.equal(application.statusHistory.length, 2);
  assert.equal(application.statusHistory[1].status, "accepted");
  assert.equal(application.statusHistory[1].actor, employerId);
  assert.equal(saves, 1);

  const unchanged = response();
  await updateApplicationStatus({ user: { id: employerId, role: "employer" }, params: { applicationId }, body: { status: "accepted" } }, unchanged);
  assert.equal(unchanged.statusCode, 200);
  assert.equal(application.statusHistory.length, 2);
  assert.equal(saves, 1);
});

test("non-owners and candidates cannot change an application or fabricate history", async () => {
  const application = {
    status: "pending",
    statusHistory: [],
    job: { createdBy: { toString: () => employerId } },
    save: async () => assert.fail("save must not be called"),
  };
  Application.findById = () => ({ populate: async () => application });
  const nonOwner = response();
  await updateApplicationStatus({ user: { id: otherEmployerId, role: "employer" }, params: { applicationId }, body: { status: "accepted" } }, nonOwner);
  assert.equal(nonOwner.statusCode, 403);

  const candidate = response();
  await updateApplicationStatus({ user: { id: candidateId, role: "candidate" }, params: { applicationId }, body: { status: "accepted", statusHistory: [{ status: "accepted" }] } }, candidate);
  assert.equal(candidate.statusCode, 403);
  assert.equal(application.statusHistory.length, 0);
});

test("application status updates reject invalid statuses", async () => {
  const res = response();

  await updateApplicationStatus({ user: { id: employerId, role: "employer" }, params: { applicationId }, body: { status: "shortlisted" } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Invalid status");
});

test("legacy applications without history are returned safely", async () => {
  const legacy = { _id: applicationId, status: "pending", createdAt: new Date(), job: { title: "Developer" } };
  Application.find = () => ({ populate: () => ({ sort: async () => [legacy] }) });
  const res = response();
  await getMyApplications({ user: { id: candidateId, role: "candidate" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.applications[0].statusHistory, undefined);
  assert.equal(res.body.applications[0].status, "pending");
});
