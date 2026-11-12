import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { deleteAdminUser } from "../controllers/adminController.js";
import Application from "../models/Application.js";
import Company from "../models/Company.js";
import Interview from "../models/Interview.js";
import Job from "../models/Job.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import User from "../models/User.js";

const adminId = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};
const originals = {
  startSession: mongoose.startSession, userFindById: User.findById, userDeleteOne: User.deleteOne,
  companyFind: Company.find, companyDeleteMany: Company.deleteMany, jobFind: Job.find, jobDeleteMany: Job.deleteMany,
  applicationDeleteMany: Application.deleteMany, interviewDeleteMany: Interview.deleteMany, resumeDeleteMany: ResumeAnalysis.deleteMany,
};
test.afterEach(() => Object.assign(mongoose, { startSession: originals.startSession }));
test.afterEach(() => {
  User.findById = originals.userFindById; User.deleteOne = originals.userDeleteOne;
  Company.find = originals.companyFind; Company.deleteMany = originals.companyDeleteMany;
  Job.find = originals.jobFind; Job.deleteMany = originals.jobDeleteMany;
  Application.deleteMany = originals.applicationDeleteMany; Interview.deleteMany = originals.interviewDeleteMany;
  ResumeAnalysis.deleteMany = originals.resumeDeleteMany;
});

const query = (records) => ({ select: () => ({ lean: () => ({ session: async () => records }) }) });

test("an admin deletes a non-admin and cascades every related record", async () => {
  const calls = [];
  User.findById = () => ({ select: async () => ({ role: "employer" }) });
  Company.find = (filter) => { calls.push(["companies", filter]); return query([{ _id: "company-1" }]); };
  Job.find = (filter) => { calls.push(["jobs", filter]); return query([{ _id: "job-1" }]); };
  for (const [name, model, method] of [
    ["applications", Application, "deleteMany"], ["interviews", Interview, "deleteMany"], ["analyses", ResumeAnalysis, "deleteMany"],
    ["jobs-delete", Job, "deleteMany"], ["companies-delete", Company, "deleteMany"], ["user", User, "deleteOne"],
  ]) model[method] = async (filter) => calls.push([name, filter]);
  mongoose.startSession = async () => ({ withTransaction: async (work) => work(), endSession: async () => {} });

  const res = response();
  await deleteAdminUser({ user: { id: adminId, role: "admin" }, params: { userId } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.find(([name]) => name === "applications")[1], { $or: [{ applicant: userId }, { job: { $in: ["job-1"] } }] });
  assert.deepEqual(calls.find(([name]) => name === "interviews")[1], { user: userId });
  assert.deepEqual(calls.find(([name]) => name === "analyses")[1], { user: userId });
  assert.deepEqual(calls.find(([name]) => name === "jobs-delete")[1], { _id: { $in: ["job-1"] } });
  assert.deepEqual(calls.find(([name]) => name === "companies-delete")[1], { createdBy: userId });
});

test("account deletion rejects self-deletion, missing users, and admin targets", async () => {
  let res = response();
  await deleteAdminUser({ user: { id: adminId, role: "admin" }, params: { userId: adminId } }, res);
  assert.equal(res.statusCode, 400);

  User.findById = () => ({ select: async () => null });
  res = response();
  await deleteAdminUser({ user: { id: adminId, role: "admin" }, params: { userId } }, res);
  assert.equal(res.statusCode, 404);

  User.findById = () => ({ select: async () => ({ role: "admin" }) });
  res = response();
  await deleteAdminUser({ user: { id: adminId, role: "admin" }, params: { userId } }, res);
  assert.equal(res.statusCode, 403);
});
