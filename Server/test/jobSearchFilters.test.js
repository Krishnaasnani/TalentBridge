import assert from "node:assert/strict";
import test from "node:test";
import { getAllJobs } from "../controllers/jobController.js";
import Company from "../models/Company.js";
import Job from "../models/Job.js";

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const originals = {
  companyFind: Company.find,
  jobCountDocuments: Job.countDocuments,
  jobFind: Job.find,
};

test.afterEach(() => {
  Company.find = originals.companyFind;
  Job.countDocuments = originals.jobCountDocuments;
  Job.find = originals.jobFind;
});

const stubJobs = (capture) => {
  Job.countDocuments = async (filter) => { capture.push(filter); return 0; };
  Job.find = () => ({ populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] });
};

test("job search and experience filtering are case-insensitive", async () => {
  const jobFilters = [];
  let companyFilter;
  stubJobs(jobFilters);
  Company.find = (filter) => { companyFilter = filter; return { select: async () => [] }; };
  const res = response();

  await getAllJobs({ query: { search: "fReShEr", experience: "fReShEr" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(companyFilter.$or[0].name.$options, "i");
  assert.deepEqual(jobFilters[0].experienceLevel, { $regex: "^fReShEr$", $options: "i" });
});

test("equivalent singular and plural year filters use the same anchored expression", async () => {
  const jobFilters = [];
  stubJobs(jobFilters);

  await getAllJobs({ query: { experience: "5yr" } }, response());
  await getAllJobs({ query: { experience: "5yrs" } }, response());

  assert.equal(jobFilters[0].experienceLevel.$regex, "^5\\s*(?:yr|yrs|year|years)(?:\\s+experience)?$");
  assert.deepEqual(jobFilters[0].experienceLevel, jobFilters[1].experienceLevel);
  assert.equal(jobFilters[0].experienceLevel.$options, "i");
});

test("blank job filters do not add restrictive search conditions", async () => {
  const jobFilters = [];
  stubJobs(jobFilters);

  await getAllJobs({ query: { search: "   ", experience: "   " } }, response());

  assert.deepEqual(jobFilters[0], { moderationStatus: { $ne: "hidden" } });
});
