import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";

const getCloudinaryRawPublicId = (resumeUrl) => {
  const match = new URL(resumeUrl).pathname.match(
    /\/raw\/upload\/(?:v\d+\/)?(.+)$/,
  );
  return match ? decodeURIComponent(match[1]) : "";
};

const toCaseInsensitiveSearch = (value) => ({
  $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  $options: "i",
});

const parseApplicantPagination = (query) => {
  const pageValue = query.page ?? "1";
  const limitValue = query.limit ?? "10";
  if (!/^\d+$/.test(String(pageValue)) || !/^\d+$/.test(String(limitValue))) return null;
  const page = Number(pageValue);
  const limit = Number(limitValue);
  if (page < 1 || limit < 1 || limit > 50) return null;
  return { page, limit };
};

// ================= APPLY FOR A JOB =================
export const applyJob = async (req, res) => {
  try {
    // Only candidates can apply
    if (req.user.role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Only candidates can apply for jobs",
      });
    }

    const { jobId } = req.params;

    if (!mongoose.isValidObjectId(jobId)) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Check if job exists
    const job = await Job.findById(jobId);

    if (!job || job.moderationStatus === "hidden") {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      applicant: req.user.id,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this job.",
      });
    }

    // Create application
    const application = await Application.create({
      job: jobId,
      applicant: req.user.id,
      status: "pending",
      statusHistory: [{
        status: "pending",
        timestamp: new Date(),
        actor: req.user.id,
      }],
    });

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this job.",
      });
    }

    console.error("APPLY JOB ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
// ================= GET MY APPLICATIONS =================
export const getMyApplications = async (req, res) => {
  try {
    // Only candidates
    if (req.user.role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Only candidates can view their applications",
      });
    }

    const applications = await Application.find({
      applicant: req.user.id,
    })
      .populate({
        path: "job",
        select: "title location jobType company",
        populate: {
          path: "company",
          select: "name logo location",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });

  } catch (error) {
    console.error("GET MY APPLICATIONS ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
// ================= GET APPLICANTS FOR A JOB =================
export const getJobApplicants = async (req, res) => {
  try {
    // Only employers
    if (req.user.role !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Only employers can view applicants",
      });
    }

    const { jobId } = req.params;

    if (!mongoose.isValidObjectId(jobId)) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const job = await Job.findById(jobId).select("title createdBy");

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (job.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can view applicants only for your own jobs",
      });
    }

    const { search = "", name = "", email = "", skills = "", status = "" } = req.query;
    const allowedStatuses = ["pending", "accepted", "rejected"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid application status" });
    }
    const pagination = parseApplicantPagination(req.query);
    if (!pagination) {
      return res.status(400).json({ success: false, message: "Page must be at least 1 and limit must be between 1 and 50" });
    }

    const applicantFilter = { role: "candidate" };
    const searchValue = String(search).trim();
    if (searchValue) {
      const expression = toCaseInsensitiveSearch(searchValue);
      applicantFilter.$or = [{ fullName: expression }, { email: expression }];
    }
    if (String(name).trim()) applicantFilter.fullName = toCaseInsensitiveSearch(String(name).trim());
    if (String(email).trim()) applicantFilter.email = toCaseInsensitiveSearch(String(email).trim());
    if (String(skills).trim()) applicantFilter.skills = toCaseInsensitiveSearch(String(skills).trim());

    const matchingApplicants = await User.find(applicantFilter).select("_id");
    const applicationFilter = {
      job: jobId,
      applicant: { $in: matchingApplicants.map((applicant) => applicant._id) },
    };
    if (status) applicationFilter.status = status;

    const [total, applications] = await Promise.all([
      Application.countDocuments(applicationFilter),
      Application.find(applicationFilter)
        .populate("applicant", "fullName email phone location skills bio resume")
        .sort({ createdAt: -1, _id: -1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit),
    ]);
    const safeApplications = applications.map((application) => {
      const applicant = application.applicant?.toObject?.() || application.applicant || {};
      return {
        _id: application._id,
        status: application.status,
        createdAt: application.createdAt,
        applicant: {
          _id: applicant._id,
          fullName: applicant.fullName,
          email: applicant.email,
          phone: applicant.phone,
          location: applicant.location,
          skills: applicant.skills,
          bio: applicant.bio,
        },
        hasResume: Boolean(applicant.resume),
      };
    });

    res.status(200).json({
      success: true,
      count: safeApplications.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(Math.ceil(total / pagination.limit), 1),
      },
      job: { _id: job._id, title: job.title },
      applications: safeApplications,
    });

  } catch (error) {
    console.error("GET JOB APPLICANTS ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load applicants",
    });
  }
};

// ================= GET APPLICANT RESUME =================
export const getApplicationResume = async (req, res) => {
  try {
    if (req.user.role !== "employer") {
      return res.status(403).json({ success: false, message: "Only employers can view applicant resumes" });
    }

    const { applicationId } = req.params;
    if (!mongoose.isValidObjectId(applicationId)) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const application = await Application.findById(applicationId)
      .populate("job", "createdBy")
      .populate("applicant", "resume");

    if (!application || !application.job || application.job.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "You can view resumes only for applicants to your own jobs" });
    }

    const resumeUrl = application.applicant?.resume;
    if (!resumeUrl || !resumeUrl.startsWith("https://")) {
      return res.status(404).json({ success: false, message: "Resume not available" });
    }

    const publicId = getCloudinaryRawPublicId(resumeUrl);
    const format = publicId.split(".").pop()?.toLowerCase();
    if (!publicId || !["pdf", "doc", "docx"].includes(format)) {
      return res.status(404).json({ success: false, message: "Resume not available" });
    }

    const signedResumeUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: "raw",
      type: "upload",
      expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const resumeResponse = await fetch(signedResumeUrl);
    if (!resumeResponse.ok) {
      return res.status(502).json({ success: false, message: "Unable to retrieve the resume" });
    }

    const contentType = resumeResponse.headers.get("content-type") || "application/octet-stream";
    const resumeBuffer = Buffer.from(await resumeResponse.arrayBuffer());
    res.set("Content-Type", contentType);
    res.set("Content-Disposition", "inline");
    return res.send(resumeBuffer);
  } catch (error) {
    console.error("GET APPLICATION RESUME ERROR:", error.message);
    return res.status(502).json({ success: false, message: "Unable to retrieve the resume" });
  }
};

// ================= UPDATE APPLICATION STATUS =================
export const updateApplicationStatus = async (req, res) => {
  try {
    // Only employers
    if (req.user.role !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Only employers can update application status",
      });
    }

    const { applicationId } = req.params;
    const { status } = req.body;

    if (!["pending", "accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    if (!mongoose.isValidObjectId(applicationId)) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const application = await Application.findById(applicationId).populate("job", "createdBy");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (!application.job || application.job.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can update applications only for your own jobs",
      });
    }

    if (application.status !== status) {
      application.status = status;
      if (!Array.isArray(application.statusHistory)) application.statusHistory = [];
      application.statusHistory.push({
        status,
        timestamp: new Date(),
        actor: req.user.id,
      });
      await application.save();
    }

    res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      application: { _id: application._id, status: application.status },
    });

  } catch (error) {
    console.error("UPDATE APPLICATION STATUS ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to update application status",
    });
  }
};

// ================= EMPLOYER APPLICATION SUMMARY =================
export const getEmployerApplicationSummary = async (req, res) => {
  try {
    if (req.user.role !== "employer") {
      return res.status(403).json({ success: false, message: "Only employers can view this summary" });
    }

    const jobs = await Job.find({ createdBy: req.user.id }).select("_id");
    const jobIds = jobs.map((job) => job._id);
    const [totalApplications, pendingApplications, acceptedApplications, rejectedApplications] = await Promise.all([
      Application.countDocuments({ job: { $in: jobIds } }),
      Application.countDocuments({ job: { $in: jobIds }, status: "pending" }),
      Application.countDocuments({ job: { $in: jobIds }, status: "accepted" }),
      Application.countDocuments({ job: { $in: jobIds }, status: "rejected" }),
    ]);

    return res.status(200).json({
      success: true,
      totalJobs: jobIds.length,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      rejectedApplications,
    });
  } catch (error) {
    console.error("GET EMPLOYER APPLICATION SUMMARY ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load application summary" });
  }
};
