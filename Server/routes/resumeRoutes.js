import express from "express";
import { analyzeJobMatch, analyzeResume } from "../controllers/resumeController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/analyze", protect, analyzeResume);
router.post("/job-match", protect, analyzeJobMatch);

export default router;
