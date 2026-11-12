import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import Interview from "../models/Interview.js";
import User from "../models/User.js";

const INTERVIEW_TYPES = ["Technical Interview", "HR Interview", "Behavioral Interview"];
const DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);
const INTERVIEW_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Adaptive"];
const QUESTION_COUNTS = [5, 10, 15, 20];
const RATINGS = new Set(["Poor", "Fair", "Good", "Strong", "Excellent"]);

const normalizeInterviewInput = (body) => ({
  contextType: typeof body.contextType === "string" ? body.contextType.trim() : "role",
  role: typeof body.role === "string" ? body.role.trim() : "",
  jobDescription: typeof body.jobDescription === "string" ? body.jobDescription.trim() : "",
  interviewType: typeof body.interviewType === "string" ? body.interviewType.trim() : "",
  difficulty: typeof body.difficulty === "string" ? body.difficulty.trim() : "",
  questionCount: body.questionCount,
});

const getInterviewValidationError = ({ contextType, role, jobDescription, interviewType, difficulty, questionCount }) => {
  if (!["role", "job_description"].includes(contextType)) return "Please select a valid interview context.";
  if (contextType === "role" && (role.length < 2 || role.length > 120)) return "Role must be between 2 and 120 characters.";
  if (contextType === "job_description" && (jobDescription.length < 1 || jobDescription.length > 10_000)) return "Job description must be between 1 and 10,000 characters.";
  if (!INTERVIEW_TYPES.includes(interviewType)) return "Please select a valid interview type.";
  if (!INTERVIEW_DIFFICULTIES.includes(difficulty)) return "Please select a valid interview difficulty.";
  if (!QUESTION_COUNTS.includes(questionCount)) return "Question count must be 5, 10, 15, or 20.";
  return null;
};

const getCloudinaryRawPublicId = (resumeUrl) => {
  const match = new URL(resumeUrl).pathname.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
  return match ? decodeURIComponent(match[1]) : "";
};

const getResumeForInterview = async (userId) => {
  const user = await User.findById(userId).select("resume");
  if (!user) return { error: "User not found.", status: 404 };
  if (!user.resume) return { error: "Please upload your resume in Profile before starting an AI interview.", status: 400 };

  const publicId = getCloudinaryRawPublicId(user.resume);
  const format = publicId.split(".").pop()?.toLowerCase();
  if (!publicId || !["pdf", "doc", "docx"].includes(format)) {
    return { error: "The uploaded resume format is not supported for AI Interview.", status: 415 };
  }

  const signedResumeUrl = cloudinary.utils.private_download_url(publicId, format, {
    resource_type: "raw",
    type: "upload",
    expires_at: Math.floor(Date.now() / 1000) + 60,
  });
  const response = await fetch(signedResumeUrl);
  if (!response.ok) return { error: "Unable to retrieve your resume for the AI interview.", status: 502 };

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    format,
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
};

const validateGeneratedQuestions = (payload, questionCount) => {
  if (!payload || !Array.isArray(payload.questions) || payload.questions.length !== questionCount) return null;

  const questions = payload.questions.map((item) => ({
    question: typeof item?.question === "string" ? item.question.trim() : "",
    category: typeof item?.category === "string" ? item.category.trim() : "",
    difficulty: item?.difficulty,
  }));

  if (questions.some(({ question, category, difficulty }) => !question || !category || !DIFFICULTIES.has(difficulty))) return null;
  return questions;
};

const validateEvaluation = (payload) => {
  if (!payload || !Number.isInteger(payload.score) || payload.score < 0 || payload.score > 100 || !RATINGS.has(payload.rating)) return null;
  const textFields = ["feedback", "improvement"];
  const listFields = ["strengths", "weaknesses"];
  if (textFields.some((field) => typeof payload[field] !== "string" || !payload[field].trim()) || listFields.some((field) => !Array.isArray(payload[field]) || payload[field].some((item) => typeof item !== "string" || !item.trim()))) return null;
  return {
    score: payload.score,
    rating: payload.rating,
    strengths: payload.strengths.map((item) => item.trim()),
    weaknesses: payload.weaknesses.map((item) => item.trim()),
    feedback: payload.feedback.trim(),
    improvement: payload.improvement.trim(),
  };
};

const buildFinalFeedback = (questions) => {
  const evaluations = questions.map((question) => question.evaluation);
  const averageScore = Math.round(evaluations.reduce((total, evaluation) => total + evaluation.score, 0) / evaluations.length);
  const frequentItems = (field) => [...new Set(evaluations.flatMap((evaluation) => evaluation[field]))].slice(0, 5);
  return {
    totalQuestions: questions.length,
    evaluatedQuestions: evaluations.length,
    averageScore,
    strengths: frequentItems("strengths"),
    recurringWeaknesses: frequentItems("weaknesses"),
    recommendations: [...new Set(evaluations.map((evaluation) => evaluation.improvement))].slice(0, 5),
  };
};

const ensureCandidate = (req, res) => {
  if (req.user?.role !== "candidate") {
    res.status(403).json({ success: false, message: "Only candidates can use AI Interview." });
    return false;
  }

  return true;
};

export const createInterview = async (req, res) => {
  try {
    if (!ensureCandidate(req, res)) return;

    const input = normalizeInterviewInput(req.body);
    const validationError = getInterviewValidationError(input);

    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const { contextType, interviewType, difficulty, questionCount } = input;
    const role = contextType === "role" ? input.role : "";
    const jobDescription = contextType === "job_description" ? input.jobDescription : "";

    const resume = await getResumeForInterview(req.user.id);
    if (resume.error) return res.status(resume.status).json({ success: false, message: resume.error });

    const interview = await Interview.create({
      user: req.user.id,
      contextType,
      role,
      jobDescription,
      interviewType,
      difficulty,
      questionCount,
      questions: [],
      status: "in_progress",
      score: null,
      feedback: null,
    });

    let aiResponse;
    try {
      const formData = new FormData();
      formData.append("contextType", contextType);
      formData.append("role", role);
      formData.append("jobDescription", jobDescription);
      formData.append("interviewType", interviewType);
      formData.append("difficulty", difficulty);
      formData.append("questionCount", String(questionCount));
      formData.append("resume", new Blob([resume.buffer], { type: resume.contentType }), `resume.${resume.format}`);
      aiResponse = await fetch(`${process.env.AI_SERVICE_URL || "http://127.0.0.1:8000"}/generate-interview`, {
        method: "POST",
        headers: { "X-AI-Service-Key": process.env.AI_SERVICE_API_KEY || "" },
        body: formData,
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      await Interview.findByIdAndDelete(interview._id);
      return res.status(503).json({ success: false, message: "AI Interview is temporarily unavailable. Please try again." });
    }

    if (!aiResponse.ok) {
      await Interview.findByIdAndDelete(interview._id);
      let message = "Unable to generate interview questions. Please try again.";
      try {
        const body = await aiResponse.json();
        if (typeof body.detail === "string") message = body.detail;
      } catch {
        // Use the safe default message for malformed AI-service errors.
      }
      const status = aiResponse.status === 400 ? 400 : aiResponse.status === 503 ? 503 : 502;
      return res.status(status).json({ success: false, message });
    }

    let generatedPayload;
    try {
      generatedPayload = await aiResponse.json();
    } catch {
      await Interview.findByIdAndDelete(interview._id);
      return res.status(502).json({ success: false, message: "The AI service returned an invalid interview response." });
    }

    const generatedQuestions = validateGeneratedQuestions(generatedPayload, questionCount);
    if (!generatedQuestions) {
      await Interview.findByIdAndDelete(interview._id);
      return res.status(502).json({ success: false, message: "The AI service returned invalid interview questions." });
    }

    interview.questions = generatedQuestions.map((item) => ({ ...item, answer: "", evaluation: null }));
    await interview.save();

    return res.status(201).json({
      success: true,
      message: "Interview questions generated successfully.",
      interview,
    });
  } catch (error) {
    console.error("CREATE INTERVIEW ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to create interview." });
  }
};

export const getMyInterviews = async (req, res) => {
  try {
    if (!ensureCandidate(req, res)) return;

    const interviews = await Interview.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: interviews.length, interviews });
  } catch (error) {
    console.error("GET MY INTERVIEWS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load interviews." });
  }
};

export const getInterviewById = async (req, res) => {
  try {
    if (!ensureCandidate(req, res)) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }

    if (interview.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "You can access only your own interviews." });
    }

    return res.status(200).json({ success: true, interview });
  } catch (error) {
    console.error("GET INTERVIEW ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load interview." });
  }
};

export const submitInterviewAnswer = async (req, res) => {
  try {
    if (!ensureCandidate(req, res)) return;
    const { id, questionIndex } = req.params;
    const index = Number(questionIndex);
    const answer = typeof req.body.answer === "string" ? req.body.answer.trim() : "";
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: "Interview not found." });
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ success: false, message: "Please select a valid interview question." });
    if (!answer) return res.status(400).json({ success: false, message: "Please enter an answer before submitting." });
    if (answer.length > 10_000) return res.status(400).json({ success: false, message: "Answer must be 10,000 characters or fewer." });

    const interview = await Interview.findOne({ _id: id, user: req.user.id });
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found." });
    if (interview.status !== "in_progress") return res.status(409).json({ success: false, message: "This interview has already been completed." });
    if (!interview.questions[index]) return res.status(400).json({ success: false, message: "Please select a valid interview question." });
    if (interview.questions[index].evaluation) return res.status(409).json({ success: false, message: "This answer has already been submitted." });

    const resume = await getResumeForInterview(req.user.id);
    if (resume.error) return res.status(resume.status).json({ success: false, message: resume.error });
    let aiResponse;
    try {
      const formData = new FormData();
      formData.append("resume", new Blob([resume.buffer], { type: resume.contentType }), `resume.${resume.format}`);
      formData.append("question", interview.questions[index].question);
      formData.append("answer", answer);
      formData.append("contextType", interview.contextType);
      formData.append("role", interview.role || "");
      formData.append("jobDescription", interview.jobDescription || "");
      formData.append("interviewType", interview.interviewType);
      formData.append("difficulty", interview.difficulty || "Intermediate");
      aiResponse = await fetch(`${process.env.AI_SERVICE_URL || "http://127.0.0.1:8000"}/evaluate-interview-answer`, { method: "POST", headers: { "X-AI-Service-Key": process.env.AI_SERVICE_API_KEY || "" }, body: formData, signal: AbortSignal.timeout(60_000) });
    } catch {
      return res.status(503).json({ success: false, message: "Answer evaluation is temporarily unavailable. Please try again." });
    }
    if (!aiResponse.ok) {
      let message = "Unable to evaluate this answer. Please try again.";
      try { const body = await aiResponse.json(); if (typeof body.detail === "string") message = body.detail; } catch { /* Safe fallback. */ }
      return res.status(aiResponse.status === 400 ? 400 : aiResponse.status === 503 ? 503 : 502).json({ success: false, message });
    }
    let evaluation;
    try { evaluation = validateEvaluation(await aiResponse.json()); } catch { evaluation = null; }
    if (!evaluation) return res.status(502).json({ success: false, message: "The AI service returned an invalid answer evaluation." });

    let updatedInterview = await Interview.findOneAndUpdate(
      { _id: id, user: req.user.id, status: "in_progress", [`questions.${index}.evaluation`]: null },
      { $set: { [`questions.${index}.answer`]: answer, [`questions.${index}.evaluation`]: evaluation } },
      { new: true, runValidators: true },
    );
    if (!updatedInterview) return res.status(409).json({ success: false, message: "This answer has already been submitted or the interview is no longer active." });

    if (updatedInterview.questions.every((question) => question.evaluation)) {
      const feedback = buildFinalFeedback(updatedInterview.questions);
      updatedInterview = await Interview.findOneAndUpdate(
        { _id: id, user: req.user.id, status: "in_progress", questions: { $not: { $elemMatch: { evaluation: null } } } },
        { $set: { status: "completed", score: feedback.averageScore, feedback } },
        { new: true, runValidators: true },
      ) || updatedInterview;
    }
    return res.status(200).json({ success: true, message: "Answer evaluated successfully.", interview: updatedInterview, evaluation });
  } catch (error) {
    console.error("SUBMIT INTERVIEW ANSWER ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to submit this answer. Please try again." });
  }
};
