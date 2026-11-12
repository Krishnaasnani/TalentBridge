import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import path from "path";

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

const allowedResumeExtensions = new Set([".pdf", ".doc", ".docx"]);
const allowedResumeMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const resumeFileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedResumeExtensions.has(extension) || !allowedResumeMimeTypes.has(file.mimetype)) {
    const error = new Error("Only PDF, DOC, and DOCX resume files are allowed.");
    error.statusCode = 400;
    return callback(error);
  }

  return callback(null, true);
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "hiremind/resumes",
    // Resumes are documents, not images. Cloudinary returns a secure raw-file URL.
    resource_type: "raw",
    public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
  }),
});

const upload = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: MAX_RESUME_SIZE_BYTES,
    files: 1,
  },
});

export default upload;
