import assert from "node:assert/strict";
import test from "node:test";
import { getJobRecommendations } from "../controllers/jobController.js";
import { scoreJobForSkills } from "../utils/recommendationScoring.js";
import User from "../models/User.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";

const candidateId = "507f1f77bcf86cd799439011";
const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};
const request = (role = "candidate") => ({ user: { id: candidateId, role } });
const originals = {
  userFindById: User.findById,
  jobFind: Job.find,
  applicationFind: Application.find,
  resumeFindOne: ResumeAnalysis.findOne,
};

test.afterEach(() => {
  User.findById = originals.userFindById;
  Job.find = originals.jobFind;
  Application.find = originals.applicationFind;
  ResumeAnalysis.findOne = originals.resumeFindOne;
});

test("scores exact, case-insensitive skills without matching unrelated words", () => {
  const result = scoreJobForSkills([" React ", "JAVA", "react"], {
    title: "React Developer",
    requirements: ["Node.js"],
    description: "Build JavaScript web applications.",
  });
  assert.equal(result.score, 50);
  assert.deepEqual(result.matchedSkills, ["react"]);
  assert.equal(scoreJobForSkills([], { title: "React", requirements: [], description: "" }).score, 0);
});

test("recommendations are candidate-only and return a skill prompt when empty", async () => {
  const denied = response();
  await getJobRecommendations(request("employer"), denied);
  assert.equal(denied.statusCode, 403);

  User.findById = () => ({ select: async () => ({ skills: [] }) });
  ResumeAnalysis.findOne = () => ({ select: async () => null });
  const emptySkills = response();
  await getJobRecommendations(request(), emptySkills);
  assert.equal(emptySkills.statusCode, 200);
  assert.equal(emptySkills.body.needsSkills, true);
  assert.deepEqual(emptySkills.body.recommendations, []);
});

test("excludes applied jobs and exposes only safe job recommendation fields", async () => {
  User.findById = () => ({ select: async () => ({ skills: ["React"] }) });
  const appliedId = "507f1f77bcf86cd799439012";
  const availableId = "507f1f77bcf86cd799439013";
  Job.find = () => ({ populate: () => ({ sort: async () => [
    { _id: appliedId, title: "React Engineer", requirements: [], description: "React role", location: "Pune", jobType: "Full-time", experienceLevel: "Fresher", company: { name: "Private Co", secret: "hidden" }, createdAt: new Date("2026-01-01") },
    { _id: availableId, title: "React Developer", requirements: ["React"], description: "", location: "Remote", jobType: "Remote", experienceLevel: "Junior", company: { name: "Public Co" }, createdAt: new Date("2026-02-01") },
  ] }) });
  Application.find = () => ({ select: async () => [{ job: appliedId }] });
  const res = response();
  await getJobRecommendations(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(String(res.body.recommendations[0].job._id), availableId);
  assert.equal("password" in res.body.recommendations[0].job, false);
  assert.equal("secret" in res.body.recommendations[0].job.company, false);
});

test("returns a useful empty response when no jobs are available", async () => {
  User.findById = () => ({ select: async () => ({ skills: ["React"] }) });
  Job.find = () => ({ populate: () => ({ sort: async () => [] }) });
  Application.find = () => ({ select: async () => [] });
  const res = response();
  await getJobRecommendations(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 0);
  assert.match(res.body.message, /No un-applied jobs/);
});
