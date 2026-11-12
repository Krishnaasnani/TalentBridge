import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  createJob,
  getMyJobs,
  getJobRecommendations,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
} from "../controllers/jobController.js";

const router = express.Router();

// Public Routes
router.get("/", getAllJobs);

// Protected Routes
router.get("/mine", protect, getMyJobs);
router.get("/recommendations", protect, getJobRecommendations);
router.post("/", protect, createJob);
router.put("/:id", protect, updateJob);
router.delete("/:id", protect, deleteJob);

router.get("/:id", getJobById);

export default router;
