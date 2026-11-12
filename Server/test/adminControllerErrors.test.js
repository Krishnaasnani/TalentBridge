import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminApplicationById,
  getAdminApplications,
  getAdminJobs,
  getAdminStats,
  getAdminUsers,
  moderateAdminJob,
} from "../controllers/adminController.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";

const objectId = "507f1f77bcf86cd799439011";
const databaseError = new Error("database failure details");

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const originals = {
  applicationCountDocuments: Application.countDocuments,
  applicationFindById: Application.findById,
  jobCountDocuments: Job.countDocuments,
  jobFindById: Job.findById,
  userCountDocuments: User.countDocuments,
};

test.afterEach(() => {
  Application.countDocuments = originals.applicationCountDocuments;
  Application.findById = originals.applicationFindById;
  Job.countDocuments = originals.jobCountDocuments;
  Job.findById = originals.jobFindById;
  User.countDocuments = originals.userCountDocuments;
});

const assertGenericDatabaseFailure = async ({ handler, req, expectedMessage, fail }) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    fail();
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { success: false, message: expectedMessage });
    assert.equal(JSON.stringify(res.body).includes(databaseError.message), false);
  } finally {
    console.error = originalConsoleError;
  }
};

test("admin controllers return generic responses for database failures", async (t) => {
  await t.test("stats", () => assertGenericDatabaseFailure({
    handler: getAdminStats,
    req: {},
    expectedMessage: "Unable to load admin statistics",
    fail: () => { User.countDocuments = async () => { throw databaseError; }; },
  }));

  await t.test("users", () => assertGenericDatabaseFailure({
    handler: getAdminUsers,
    req: { query: {} },
    expectedMessage: "Unable to load users",
    fail: () => { User.countDocuments = async () => { throw databaseError; }; },
  }));

  await t.test("jobs", () => assertGenericDatabaseFailure({
    handler: getAdminJobs,
    req: { query: {} },
    expectedMessage: "Unable to load jobs",
    fail: () => { Job.countDocuments = async () => { throw databaseError; }; },
  }));

  await t.test("moderation", () => assertGenericDatabaseFailure({
    handler: moderateAdminJob,
    req: { user: { id: objectId }, params: { jobId: objectId }, body: { status: "hidden" } },
    expectedMessage: "Unable to update job moderation",
    fail: () => { Job.findById = async () => { throw databaseError; }; },
  }));

  await t.test("application list", () => assertGenericDatabaseFailure({
    handler: getAdminApplications,
    req: { query: {} },
    expectedMessage: "Unable to load applications",
    fail: () => { Application.countDocuments = async () => { throw databaseError; }; },
  }));

  await t.test("application detail", () => assertGenericDatabaseFailure({
    handler: getAdminApplicationById,
    req: { params: { applicationId: objectId } },
    expectedMessage: "Unable to load application details",
    fail: () => { Application.findById = () => ({ populate: async () => { throw databaseError; } }); },
  }));
});
