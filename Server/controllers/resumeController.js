import cloudinary from "../config/cloudinary.js";
import crypto from "crypto";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import User from "../models/User.js";

const supportedFormats = new Set(["pdf", "doc", "docx"]);

const getCloudinaryRawPublicId = (resumeUrl) => {
  const match = new URL(resumeUrl).pathname.match(
    /\/raw\/upload\/(?:v\d+\/)?(.+)$/,
  );
  return match ? decodeURIComponent(match[1]) : "";
};

const getSafeAiMessage = async (response) => {
  try {
    const body = await response.json();
    return typeof body.detail === "string" ? body.detail : "Unable to analyze the resume.";
  } catch {
    return "Unable to analyze the resume.";
  }
};

const isScore = (value) => Number.isInteger(value) && value >= 0 && value <= 100;

const validateJobMatch = (analysis) => {
  const scoreFields = ["requiredSkills", "preferredSkills", "experience", "responsibilities", "education", "tools", "domainKeywords", "roleAlignment", "requirementCoverage"];
  const listFields = ["matchedRequirements", "partialMatches", "missingRequirements", "responsibilityMatches", "resumeStrengths", "gaps", "improvements", "resumeImprovements"];
  const errors = [];
  if (!isScore(analysis?.overallMatchScore)) errors.push("overallMatchScore: expected integer 0-100");
  if (!analysis?.scoreBreakdown || typeof analysis.scoreBreakdown !== "object") {
    errors.push("scoreBreakdown: expected object");
  } else {
    scoreFields.forEach((field) => {
      const value = analysis.scoreBreakdown[field];
      if (value !== null && !isScore(value)) errors.push(`scoreBreakdown.${field}: expected integer 0-100 or null`);
    });
  }
  if (!analysis?.jobRequirements || typeof analysis.jobRequirements !== "object" || Array.isArray(analysis.jobRequirements)) {
    errors.push("jobRequirements: expected object");
  }
  listFields.forEach((field) => {
    if (!Array.isArray(analysis?.[field])) errors.push(`${field}: expected array`);
  });
  return errors;
};

export const analyzeResume = async (req, res) => {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ success: false, message: "Only candidates can use the AI Resume Analyzer." });
    }

    const user = await User.findById(req.user.id).select("resume");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.resume) {
      return res.status(400).json({ success: false, message: "Please upload your resume before using the AI Resume Analyzer." });
    }

    const publicId = getCloudinaryRawPublicId(user.resume);
    const format = publicId.split(".").pop()?.toLowerCase();
    if (!publicId || !supportedFormats.has(format)) {
      return res.status(415).json({ success: false, message: "The uploaded resume format is not supported for analysis." });
    }

    const signedResumeUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: "raw",
      type: "upload",
      expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const resumeResponse = await fetch(signedResumeUrl);
    if (!resumeResponse.ok) {
      return res.status(502).json({ success: false, message: "Unable to retrieve your resume for analysis." });
    }

    const resumeBuffer = Buffer.from(await resumeResponse.arrayBuffer());
    const resumeHash = crypto.createHash("sha256").update(resumeBuffer).digest("hex");
    const existingAnalysis = await ResumeAnalysis.findOne({ user: req.user.id, resumeHash });

    console.info("[Resume Analyzer]", {
      userId: String(req.user.id),
      resumeHash,
      cachedAnalysisFound: Boolean(existingAnalysis),
      callingFastAPI: !existingAnalysis,
    });

    if (existingAnalysis) {
      console.info("[Resume Analyzer] Returning cached analysis");
      return res.status(200).json({ success: true, analysis: existingAnalysis });
    }

    console.info("[Resume Analyzer] No cached analysis found - generating new analysis");

    const formData = new FormData();
    formData.append(
      "resume",
      new Blob([resumeBuffer], { type: resumeResponse.headers.get("content-type") || "application/octet-stream" }),
      `resume.${format}`,
    );

    let aiResponse;
    try {
      aiResponse = await fetch(`${process.env.AI_SERVICE_URL || "http://127.0.0.1:8000"}/analyze-resume`, {
        method: "POST",
        headers: { "X-AI-Service-Key": process.env.AI_SERVICE_API_KEY || "" },
        body: formData,
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      return res.status(503).json({ success: false, message: "The AI Resume Analyzer is temporarily unavailable. Please try again later." });
    }

    if (!aiResponse.ok) {
      const message = await getSafeAiMessage(aiResponse);
      const status = aiResponse.status === 400 || aiResponse.status === 415 ? aiResponse.status : 502;
      return res.status(status).json({ success: false, message });
    }

    const analysis = await aiResponse.json();
    const atsScoreFields = [
      "formatting", "contactInformation", "professionalSummary", "skills",
      "experience", "projects", "education", "linksAndKeywords",
    ];
    const isValidAnalysis = Number.isInteger(analysis.overallScore)
      && analysis.overallScore >= 0
      && analysis.overallScore <= 100
      && ["extractedSkills", "strengths", "weaknesses", "suggestions"].every(
        (field) => Array.isArray(analysis[field]) && analysis[field].every((item) => typeof item === "string"),
      )
      && Array.isArray(analysis.atsHighlights)
      && analysis.atsHighlights.every((item) => typeof item === "string")
      && atsScoreFields.every((field) => Number.isInteger(analysis.atsBreakdown?.[field])
        && analysis.atsBreakdown[field] >= 0 && analysis.atsBreakdown[field] <= 100);

    if (!isValidAnalysis) {
      return res.status(502).json({ success: false, message: "The AI Resume Analyzer returned an invalid response. Please try again later." });
    }

    const savedAnalysis = await ResumeAnalysis.findOneAndUpdate(
      { user: req.user.id },
      { ...analysis, user: req.user.id, resumeUrl: user.resume, resumeHash, analyzedAt: new Date() },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    console.info(`[Resume Analyzer] Analysis saved for resumeHash: ${resumeHash}`);

    return res.status(200).json({ success: true, analysis: savedAnalysis });
  } catch (error) {
    console.error("ANALYZE RESUME ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to analyze the resume. Please try again later." });
  }
};

export const analyzeJobMatch = async (req, res) => {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ success: false, message: "Only candidates can use Job Match." });
    }

    const jobDescription = typeof req.body.jobDescription === "string" ? req.body.jobDescription.trim() : "";
    if (!jobDescription) {
      return res.status(400).json({ success: false, message: "Please enter a job description." });
    }
    if (jobDescription.length > 10_000) {
      return res.status(400).json({ success: false, message: "Job description must be 10,000 characters or fewer." });
    }

    const user = await User.findById(req.user.id).select("resume");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (!user.resume) {
      return res.status(400).json({ success: false, message: "Please upload your resume in Profile before using Job Match." });
    }

    const publicId = getCloudinaryRawPublicId(user.resume);
    const format = publicId.split(".").pop()?.toLowerCase();
    if (!publicId || !supportedFormats.has(format)) {
      return res.status(415).json({ success: false, message: "The uploaded resume format is not supported for analysis." });
    }
    const signedResumeUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: "raw", type: "upload", expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const resumeResponse = await fetch(signedResumeUrl);
    if (!resumeResponse.ok) {
      return res.status(502).json({ success: false, message: "Unable to retrieve your resume for analysis." });
    }

    const formData = new FormData();
    formData.append("resume_file", new Blob([await resumeResponse.arrayBuffer()], {
      type: resumeResponse.headers.get("content-type") || "application/octet-stream",
    }), `resume.${format}`);
    formData.append("job_description", jobDescription);

    let aiResponse;
    try {
      aiResponse = await fetch(`${process.env.AI_SERVICE_URL || "http://127.0.0.1:8000"}/match-job`, {
        method: "POST", headers: { "X-AI-Service-Key": process.env.AI_SERVICE_API_KEY || "" }, body: formData, signal: AbortSignal.timeout(60_000),
      });
    } catch {
      return res.status(503).json({ success: false, message: "AI service is temporarily unavailable. Please try again." });
    }
    if (!aiResponse.ok) {
      const message = await getSafeAiMessage(aiResponse);
      const status = aiResponse.status === 400 || aiResponse.status === 415 ? aiResponse.status : 502;
      return res.status(status).json({ success: false, message: aiResponse.status === 503 ? "AI service is temporarily unavailable. Please try again." : message });
    }

    const analysis = await aiResponse.json();
    console.info("[Job Match] FastAPI response shape", {
      topLevelKeys: Object.keys(analysis || {}),
      overallMatchScore: analysis?.overallMatchScore,
      scoreBreakdown: analysis?.scoreBreakdown,
    });
    const validationErrors = validateJobMatch(analysis);
    if (validationErrors.length) {
      console.warn("[Job Match] Response validation failed", { errors: validationErrors });
      return res.status(502).json({ success: false, message: "The AI service returned an invalid job match response. Please try again." });
    }
    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    console.error("JOB MATCH ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to analyze the job match. Please try again later." });
  }
};
