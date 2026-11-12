import assert from "node:assert/strict";
import test from "node:test";
import { getAdminApplicationById } from "../controllers/adminController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import Application from "../models/Application.js";

const applicationId = "507f1f77bcf86cd799439011";

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const originalFindById = Application.findById;

test.afterEach(() => {
  Application.findById = originalFindById;
});

test("admin application details require authentication and an admin role", () => {
  const unauthenticated = response();
  protect({ headers: {} }, unauthenticated, () => assert.fail("next must not run"));
  assert.equal(unauthenticated.statusCode, 401);

  for (const role of ["candidate", "employer"]) {
    const res = response();
    adminOnly({ user: { role } }, res, () => assert.fail("next must not run"));
    assert.equal(res.statusCode, 403);
  }
});

test("admin application details reject invalid and missing applications", async () => {
  const invalid = response();
  await getAdminApplicationById({ params: { applicationId: "not-an-id" } }, invalid);
  assert.equal(invalid.statusCode, 400);

  Application.findById = () => ({ populate: async () => null });
  const missing = response();
  await getAdminApplicationById({ params: { applicationId } }, missing);
  assert.equal(missing.statusCode, 404);
});

test("an admin receives a safe read-only application detail response", async () => {
  const statusHistory = [
    { status: "pending", timestamp: new Date("2026-01-01T10:00:00Z"), actor: { fullName: "Ada Candidate", email: "ada@example.test", password: "secret" } },
    { status: "accepted", timestamp: new Date("2026-01-02T10:00:00Z"), actor: { fullName: "Erin Employer", email: "erin@example.test", resume: "https://private.example/resume.pdf" } },
  ];
  const application = {
    _id: applicationId,
    applicant: { fullName: "Ada Candidate", email: "ada@example.test", password: "secret", resume: "https://private.example/resume.pdf" },
    job: {
      title: "Platform Engineer",
      description: "Private job description",
      company: { name: "Acme", website: "https://private.example" },
      createdBy: { fullName: "Erin Employer", email: "erin@example.test", password: "secret" },
    },
    status: "accepted",
    createdAt: new Date("2026-01-01T09:00:00Z"),
    updatedAt: new Date("2026-01-02T10:00:00Z"),
    statusHistory,
  };
  const historySnapshot = structuredClone(statusHistory);
  Application.findById = () => ({ populate: async () => application });
  const res = response();

  await getAdminApplicationById({ params: { applicationId } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.applicant, { fullName: "Ada Candidate", email: "ada@example.test" });
  assert.deepEqual(res.body.data.job, {
    title: "Platform Engineer",
    company: { name: "Acme" },
    employer: { fullName: "Erin Employer", email: "erin@example.test" },
  });
  assert.deepEqual(res.body.data.statusHistory[0].actor, { fullName: "Ada Candidate", email: "ada@example.test" });
  assert.equal("password" in res.body.data.applicant, false);
  assert.equal("resume" in res.body.data.applicant, false);
  assert.equal("description" in res.body.data.job, false);
  assert.deepEqual(statusHistory, historySnapshot);
});

test("missing related records are represented safely", async () => {
  Application.findById = () => ({ populate: async () => ({
    _id: applicationId,
    applicant: null,
    job: null,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    statusHistory: [{ status: "pending", timestamp: new Date(), actor: null }],
  }) });
  const res = response();

  await getAdminApplicationById({ params: { applicationId } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.applicant, null);
  assert.equal(res.body.data.job, null);
  assert.equal(res.body.data.statusHistory[0].actor, null);
});

test("the company creator is used safely when a job creator record is missing", async () => {
  Application.findById = () => ({ populate: async () => ({
    _id: applicationId,
    applicant: { fullName: "Ada Candidate", email: "ada@example.test" },
    job: {
      title: "Platform Engineer",
      createdBy: null,
      company: { name: "Acme", createdBy: { fullName: "Erin Employer", email: "erin@example.test" } },
    },
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    statusHistory: [],
  }) });
  const res = response();

  await getAdminApplicationById({ params: { applicationId } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.job, {
    title: "Platform Engineer",
    company: { name: "Acme" },
    employer: { fullName: "Erin Employer", email: "erin@example.test" },
  });
});
