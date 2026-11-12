import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import adminRoutes from "../routes/adminRoutes.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";

const adminId = "507f1f77bcf86cd799439011";
const jobId = "507f1f77bcf86cd799439012";
const applicationId = "507f1f77bcf86cd799439013";
const testSecret = "admin-route-authorization-test-secret";

// The middleware reads this value; it is a test-only signing key, not an environment-file value.
process.env.JWT_SECRET = testSecret;

const endpoints = [
  { name: "health", path: "/health", method: "GET" },
  { name: "stats", path: "/stats", method: "GET", handler: "stats" },
  { name: "users", path: "/users", method: "GET", handler: "users" },
  { name: "user deletion", path: `/users/${applicationId}`, method: "DELETE" },
  { name: "jobs", path: "/jobs", method: "GET", handler: "jobs" },
  { name: "moderation", path: `/jobs/${jobId}/moderation`, method: "PATCH", body: { status: "hidden" }, handler: "moderation" },
  { name: "applications", path: "/applications", method: "GET", handler: "applications" },
  { name: "application detail", path: `/applications/${applicationId}`, method: "GET", handler: "applicationDetail" },
];

const originals = {
  applicationCountDocuments: Application.countDocuments,
  applicationFind: Application.find,
  applicationFindById: Application.findById,
  jobCountDocuments: Job.countDocuments,
  jobFind: Job.find,
  jobFindById: Job.findById,
  userCountDocuments: User.countDocuments,
  userFind: User.find,
};

const chain = (value) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean: async () => value,
});

const tokenFor = (role) => jwt.sign({ id: adminId, role }, testSecret);

const withServer = async (run) => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });

  try {
    await run(`http://127.0.0.1:${server.address().port}/api/admin`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
};

const request = async (baseUrl, endpoint, token) => {
  const headers = endpoint.body ? { "Content-Type": "application/json" } : {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${endpoint.path}`, {
    method: endpoint.method,
    headers,
    body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
  });
};

test.afterEach(() => {
  Application.countDocuments = originals.applicationCountDocuments;
  Application.find = originals.applicationFind;
  Application.findById = originals.applicationFindById;
  Job.countDocuments = originals.jobCountDocuments;
  Job.find = originals.jobFind;
  Job.findById = originals.jobFindById;
  User.countDocuments = originals.userCountDocuments;
  User.find = originals.userFind;
});

test("every admin route rejects unauthenticated requests", async () => {
  await withServer(async (baseUrl) => {
    for (const endpoint of endpoints) {
      const response = await request(baseUrl, endpoint);
      assert.equal(response.status, 401, endpoint.name);
    }
  });
});

test("every admin route rejects invalid and expired tokens", async () => {
  const invalidToken = "not-a-jwt";
  const expiredToken = jwt.sign({ id: adminId, role: "admin" }, testSecret, { expiresIn: -1 });

  await withServer(async (baseUrl) => {
    for (const [label, token] of [["invalid", invalidToken], ["expired", expiredToken]]) {
      for (const endpoint of endpoints) {
        const response = await request(baseUrl, endpoint, token);
        assert.equal(response.status, 401, `${label}: ${endpoint.name}`);
      }
    }
  });
});

test("every admin route rejects authenticated candidates and employers", async () => {
  await withServer(async (baseUrl) => {
    for (const role of ["candidate", "employer"]) {
      for (const endpoint of endpoints) {
        const response = await request(baseUrl, endpoint, tokenFor(role));
        assert.equal(response.status, 403, `${role}: ${endpoint.name}`);
      }
    }
  });
});

test("every admin route allows an admin through to its handler", async () => {
  const reached = new Set();
  User.countDocuments = async () => { reached.add("stats"); return 0; };
  Job.countDocuments = async () => { reached.add("stats"); return 0; };
  Application.countDocuments = async () => { reached.add("stats"); return 0; };
  User.find = () => { reached.add("users"); return chain([]); };
  Job.find = () => { reached.add("jobs"); return chain([]); };
  Job.findById = async () => {
    reached.add("moderation");
    return { _id: jobId, title: "Test job", moderationStatus: "active", save: async () => {} };
  };
  Application.find = () => { reached.add("applications"); return chain([]); };
  Application.findById = () => ({ populate: async () => {
    reached.add("applicationDetail");
    return { _id: applicationId, applicant: null, job: null, status: "pending", createdAt: new Date(), updatedAt: new Date(), statusHistory: [] };
  } });

  await withServer(async (baseUrl) => {
    for (const endpoint of endpoints.filter((endpoint) => endpoint.name !== "user deletion")) {
      const response = await request(baseUrl, endpoint, tokenFor("admin"));
      assert.equal(response.status, 200, endpoint.name);
    }
  });

  assert.deepEqual(reached, new Set(endpoints.filter(({ handler }) => handler).map(({ handler }) => handler)));
});
