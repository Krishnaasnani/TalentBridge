import express from "express";
import {
  createCompany,
  getMyCompany,
  updateCompany,
} from "../controllers/companyController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/", protect, createCompany);

router.get("/my-company", protect, getMyCompany);

router.put("/update/:id", protect, updateCompany);

export default router;
