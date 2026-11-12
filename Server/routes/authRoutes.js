import express from "express";

import { registerUser, loginUser } from "../controllers/authController.js";
import { authRateLimit } from "../middleware/authRateLimitMiddleware.js";

const router = express.Router();

// Register
router.post("/register", authRateLimit, registerUser);

// Login
router.post("/login", authRateLimit, loginUser);

export default router;
