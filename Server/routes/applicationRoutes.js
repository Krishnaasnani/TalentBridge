import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  applyJob,
  getMyApplications,
  getJobApplicants,
  getApplicationResume,
  updateApplicationStatus,
  getEmployerApplicationSummary,
} from "../controllers/applicationController.js";

const router = express.Router();

// Candidate Routes
router.post("/apply/:jobId", protect, applyJob);
router.get("/my-applications", protect, getMyApplications);

// Employer Routes
router.get("/employer-summary", protect, getEmployerApplicationSummary);
router.get("/job/:jobId", protect, getJobApplicants);
router.get("/:applicationId/resume", protect, getApplicationResume);
router.patch("/:applicationId/status", protect, updateApplicationStatus);

export default router;
