import express from "express";
import { getMyResume, getProfile, updateProfile } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/profile", protect, getProfile);
router.get("/resume", protect, getMyResume);

router.put("/profile", protect, (req, res, next) => {
  upload.single("resume")(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Resume must be 10 MB or smaller.",
      });
    }

    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(502).json({
      success: false,
      message: "Unable to upload the resume. Please try again.",
    });
  });
}, updateProfile);

export default router;
