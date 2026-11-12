import assert from "node:assert/strict";
import test from "node:test";
import { protect } from "../middleware/authMiddleware.js";
import {
  createInterview,
  getInterviewById,
  getMyInterviews,
  submitInterviewAnswer,
} from "../controllers/interviewController.js";
import cloudinary from "../config/cloudinary.js";
import Interview from "../models/Interview.js";
import User from "../models/User.js";

const candidateId = "507f1f77bcf86cd799439011";
const otherCandidateId = "507f191e810c19729de860ea";
const interviewId = "507f1f77bcf86cd799439012";

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const candidateRequest = (body = {}) => ({ user: { id: candidateId, role: "candidate" }, body, params: {} });
const validInterviewInput = () => ({
  contextType: "role",
  role: "Backend Engineer",
  interviewType: "Technical Interview",
  difficulty: "Intermediate",
  questionCount: 5,
});

const restore = (object, key, value) => { object[key] = value; };
const original = {
  interviewCreate: Interview.create,
  interviewFindById: Interview.findById,
  interviewFind: Interview.find,
  interviewFindOne: Interview.findOne,
  interviewFindOneAndUpdate: Interview.findOneAndUpdate,
  userFindById: User.findById,
  privateDownloadUrl: cloudinary.utils.private_download_url,
  fetch: globalThis.fetch,
};

test.afterEach(() => {
  restore(Interview, "create", original.interviewCreate);
  restore(Interview, "findById", original.interviewFindById);
  restore(Interview, "find", original.interviewFind);
  restore(Interview, "findOne", original.interviewFindOne);
  restore(Interview, "findOneAndUpdate", original.interviewFindOneAndUpdate);
  restore(User, "findById", original.userFindById);
  restore(cloudinary.utils, "private_download_url", original.privateDownloadUrl);
  globalThis.fetch = original.fetch;
});

const mockResume = () => {
  User.findById = () => ({ select: async () => ({ resume: "https://res.cloudinary.com/demo/raw/upload/v1/resumes/candidate.pdf" }) });
  cloudinary.utils.private_download_url = () => "https://example.test/resume.pdf";
};

const generatedQuestions = Array.from({ length: 5 }, (_, index) => ({
  question: `Question ${index + 1}?`, category: "Technical", difficulty: "Medium",
}));

test("protect rejects unauthenticated interview access", () => {
  const res = response();
  protect({ headers: {} }, res, () => assert.fail("next must not be called"));
  assert.equal(res.statusCode, 401);
});

test("interview controller rejects non-candidates and invalid setup values", async () => {
  const employer = candidateRequest(validInterviewInput());
  employer.user.role = "employer";
  const employerRes = response();
  await createInterview(employer, employerRes);
  assert.equal(employerRes.statusCode, 403);

  for (const body of [
    { ...validInterviewInput(), questionCount: 7 },
    { ...validInterviewInput(), difficulty: "Impossible" },
    { ...validInterviewInput(), contextType: "job_description", role: "", jobDescription: "" },
  ]) {
    const res = response();
    await createInterview(candidateRequest(body), res);
    assert.equal(res.statusCode, 400);
  }
});

test("employer cannot submit an interview answer", async () => {
  const employer = candidateRequest({ answer: "An answer." });
  employer.user.role = "employer";
  employer.params = { id: interviewId, questionIndex: "0" };
  const res = response();

  await submitInterviewAnswer(employer, res);

  assert.equal(res.statusCode, 403);
});

test("candidate creates a job-description interview without a role", async () => {
  mockResume();
  const created = { _id: interviewId, questions: [], save: async () => {} };
  Interview.create = async (data) => { Object.assign(created, data); return created; };
  globalThis.fetch = async () => new Response(JSON.stringify({ questions: generatedQuestions }), { status: 200 });

  const req = candidateRequest({ ...validInterviewInput(), contextType: "job_description", role: "", jobDescription: "Build reliable APIs." });
  const res = response();
  await createInterview(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(created.role, "");
  assert.equal(created.jobDescription, "Build reliable APIs.");
  assert.equal(created.questions.length, 5);
});

test("interview retrieval enforces candidate ownership and history scope", async () => {
  Interview.findById = async () => ({ user: { toString: () => otherCandidateId } });
  const ownerRes = response();
  await getInterviewById({ ...candidateRequest(), params: { id: interviewId } }, ownerRes);
  assert.equal(ownerRes.statusCode, 403);

  const completedInterview = { user: { toString: () => candidateId }, status: "completed", score: 80 };
  Interview.findById = async () => completedInterview;
  const completedRes = response();
  await getInterviewById({ ...candidateRequest(), params: { id: interviewId } }, completedRes);
  assert.equal(completedRes.statusCode, 200);
  assert.equal(completedRes.body.interview, completedInterview);

  let query;
  Interview.find = (value) => { query = value; return { sort: async () => [] }; };
  const historyRes = response();
  await getMyInterviews(candidateRequest(), historyRes);
  assert.equal(historyRes.statusCode, 200);
  assert.deepEqual(query, { user: candidateId });
});

test("interview retrieval rejects malformed IDs", async () => {
  const res = response();

  await getInterviewById({ ...candidateRequest(), params: { id: "not-an-object-id" } }, res);

  assert.equal(res.statusCode, 404);
});

test("answer submission rejects malformed interview IDs", async () => {
  const res = response();

  await submitInterviewAnswer({ ...candidateRequest({ answer: "An answer." }), params: { id: "not-an-object-id", questionIndex: "0" } }, res);

  assert.equal(res.statusCode, 404);
});

test("interview retrieval returns 404 for a nonexistent interview", async () => {
  Interview.findById = async () => null;
  const res = response();

  await getInterviewById({ ...candidateRequest(), params: { id: interviewId } }, res);

  assert.equal(res.statusCode, 404);
});

test("answer submission requires a non-empty answer", async () => {
  const res = response();
  await submitInterviewAnswer({ ...candidateRequest({ answer: "   " }), params: { id: interviewId, questionIndex: "0" } }, res);
  assert.equal(res.statusCode, 400);
});

test("an evaluated answer is persisted but does not complete an incomplete interview", async () => {
  mockResume();
  const active = {
    status: "in_progress",
    contextType: "role",
    role: "Backend Engineer",
    interviewType: "Technical Interview",
    difficulty: "Intermediate",
    questions: [
      { question: "First?", evaluation: null },
      { question: "Second?", evaluation: null },
    ],
  };
  const persisted = { ...active, questions: [{ ...active.questions[0], evaluation: { score: 80 } }, active.questions[1]] };
  Interview.findOne = async () => active;
  let updates = 0;
  Interview.findOneAndUpdate = async () => { updates += 1; return persisted; };
  globalThis.fetch = async () => new Response(JSON.stringify({ score: 80, rating: "Strong", strengths: ["Clarity"], weaknesses: ["Detail"], feedback: "Good answer.", improvement: "Add examples." }), { status: 200 });

  const res = response();
  await submitInterviewAnswer({ ...candidateRequest({ answer: "A sufficiently detailed answer." }), params: { id: interviewId, questionIndex: "0" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.evaluation.score, 80);
  assert.equal(updates, 1);
  assert.equal(res.body.interview.status, "in_progress");
});

test("final evaluated answer completes the interview with a server-calculated score", async () => {
  mockResume();
  const active = { status: "in_progress", contextType: "role", role: "Backend Engineer", interviewType: "Technical Interview", difficulty: "Intermediate", questions: [{ question: "Question?", evaluation: null }] };
  const evaluated = { ...active, questions: [{ question: "Question?", evaluation: { score: 80, strengths: ["Clarity"], weaknesses: ["Detail"], improvement: "Add examples." } }] };
  const completed = { ...evaluated, status: "completed", score: 80, feedback: { averageScore: 80 } };
  Interview.findOne = async () => active;
  const updates = [];
  Interview.findOneAndUpdate = async (_query, update) => { updates.push(update); return updates.length === 1 ? evaluated : completed; };
  globalThis.fetch = async () => new Response(JSON.stringify({ score: 80, rating: "Strong", strengths: ["Clarity"], weaknesses: ["Detail"], feedback: "Good answer.", improvement: "Add examples." }), { status: 200 });

  const res = response();
  await submitInterviewAnswer({ ...candidateRequest({ answer: "A sufficiently detailed answer." }), params: { id: interviewId, questionIndex: "0" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.interview.status, "completed");
  assert.equal(res.body.interview.score, 80);
  assert.equal(updates.length, 2);
});
