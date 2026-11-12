import express from "express";
import {
  getAdminApplications,
  getAdminApplicationById,
  getAdminJobs,
  getAdminStats,
  getAdminUsers,
  deleteAdminUser,
  moderateAdminJob,
} from "../controllers/adminController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/health", protect, adminOnly, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Admin access verified",
  });
});

router.get("/stats", protect, adminOnly, getAdminStats);
router.get("/users", protect, adminOnly, getAdminUsers);
router.delete("/users/:userId", protect, adminOnly, deleteAdminUser);
router.get("/jobs", protect, adminOnly, getAdminJobs);
router.patch("/jobs/:jobId/moderation", protect, adminOnly, moderateAdminJob);
router.get("/applications", protect, adminOnly, getAdminApplications);
router.get("/applications/:applicationId", protect, adminOnly, getAdminApplicationById);

export default router;
