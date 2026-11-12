import mongoose from "mongoose";

const resumeAnalysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    resumeUrl: {
      type: String,
      required: true,
    },
    resumeHash: {
      type: String,
      index: true,
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    extractedSkills: [{ type: String }],
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    suggestions: [{ type: String }],
    atsBreakdown: {
      formatting: { type: Number, min: 0, max: 100 },
      contactInformation: { type: Number, min: 0, max: 100 },
      professionalSummary: { type: Number, min: 0, max: 100 },
      skills: { type: Number, min: 0, max: 100 },
      experience: { type: Number, min: 0, max: 100 },
      projects: { type: Number, min: 0, max: 100 },
      education: { type: Number, min: 0, max: 100 },
      linksAndKeywords: { type: Number, min: 0, max: 100 },
    },
    atsHighlights: [{ type: String }],
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const ResumeAnalysis = mongoose.model("ResumeAnalysis", resumeAnalysisSchema);

export default ResumeAnalysis;
