import express from "express";
import {
  createInterview,
  getInterviewById,
  getMyInterviews,
  submitInterviewAnswer,
} from "../controllers/interviewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createInterview);
router.get("/my-interviews", protect, getMyInterviews);
router.post("/:id/questions/:questionIndex/answer", protect, submitInterviewAnswer);
router.get("/:id", protect, getInterviewById);

export default router;
