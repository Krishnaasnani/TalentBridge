import assert from "node:assert/strict";
import test from "node:test";
import { createJob, getMyJobs } from "../controllers/jobController.js";
import Company from "../models/Company.js";
import Job from "../models/Job.js";

const employerId = "507f1f77bcf86cd799439011";

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const originals = { companyFindOne: Company.findOne, jobCreate: Job.create, jobFind: Job.find };

test.afterEach(() => {
  Company.findOne = originals.companyFindOne;
  Job.create = originals.jobCreate;
  Job.find = originals.jobFind;
});

test("an employer can create a job under their existing company", async () => {
  const company = { _id: "company-id" };
  let created;
  Company.findOne = async (filter) => { assert.deepEqual(filter, { createdBy: employerId }); return company; };
  Job.create = async (data) => { created = data; return { _id: "job-id", ...data }; };
  const res = response();

  await createJob({
    user: { id: employerId, role: "employer" },
    body: { title: " Backend Engineer ", description: " Build APIs ", requirements: [" Node.js " ], salary: " 12 LPA ", companyName: "Acme", location: " Pune ", experienceLevel: " Fresher ", jobType: "Full-time" },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(created, { title: "Backend Engineer", description: "Build APIs", requirements: ["Node.js"], salary: "12 LPA", location: "Pune", experienceLevel: "Fresher", jobType: "Full-time", company: "company-id", createdBy: employerId });
});

test("my-jobs listing is scoped to the authenticated employer", async () => {
  let filter;
  const jobs = [{ _id: "job-id", createdBy: employerId, title: "Backend Engineer" }];
  Job.find = (value) => {
    filter = value;
    return { populate() { return this; }, sort: async () => jobs };
  };
  const res = response();

  await getMyJobs({ user: { id: employerId, role: "employer" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, { createdBy: employerId });
  assert.deepEqual(res.body.jobs, jobs);
});
