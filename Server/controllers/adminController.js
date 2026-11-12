import Application from "../models/Application.js";
import Company from "../models/Company.js";
import Interview from "../models/Interview.js";
import Job from "../models/Job.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const USER_ROLES = ["admin", "employer", "candidate"];
const APPLICATION_STATUSES = ["pending", "accepted", "rejected"];
const MAX_LIMIT = 100;
const MAX_MODERATION_REASON_LENGTH = 500;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPagination = (query) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    return { error: "Page must be a positive integer" };
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `Limit must be an integer between 1 and ${MAX_LIMIT}` };
  }

  return { page, limit };
};

const paginationResponse = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});

export const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      candidates,
      employers,
      totalJobs,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      rejectedApplications,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "candidate" }),
      User.countDocuments({ role: "employer" }),
      Job.countDocuments(),
      Application.countDocuments(),
      Application.countDocuments({ status: "pending" }),
      Application.countDocuments({ status: "accepted" }),
      Application.countDocuments({ status: "rejected" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        candidates,
        employers,
        totalJobs,
        totalApplications,
        pendingApplications,
        acceptedApplications,
        rejectedApplications,
      },
    });
  } catch (error) {
    console.error("GET ADMIN STATS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load admin statistics" });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const { page, limit, error } = getPagination(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    const filter = {};
    const role = typeof req.query.role === "string" ? req.query.role.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (role) {
      if (!USER_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role filter" });
      }
      filter.role = role;
    }

    if (search) {
      const expression = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ fullName: expression }, { email: expression }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("fullName email role company isVerified createdAt updatedAt")
        .populate("company", "name location")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: { users, pagination: paginationResponse(page, limit, total) },
    });
  } catch (error) {
    console.error("GET ADMIN USERS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load users" });
  }
};

export const deleteAdminUser = async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  if (String(req.user.id) === String(userId)) {
    return res.status(400).json({ success: false, message: "You cannot delete your own account" });
  }

  try {
    const user = await User.findById(userId).select("role");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Admin accounts are deliberately excluded from account deletion.
    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Admin accounts cannot be deleted" });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const companies = await Company.find({ createdBy: userId }).select("_id").lean().session(session);
        const companyIds = companies.map((company) => company._id);
        const jobs = await Job.find({
          $or: [{ createdBy: userId }, ...(companyIds.length ? [{ company: { $in: companyIds } }] : [])],
        }).select("_id").lean().session(session);
        const jobIds = jobs.map((job) => job._id);

        await Application.deleteMany({
          $or: [{ applicant: userId }, ...(jobIds.length ? [{ job: { $in: jobIds } }] : [])],
        }, { session });
        await Interview.deleteMany({ user: userId }, { session });
        await ResumeAnalysis.deleteMany({ user: userId }, { session });
        await Job.deleteMany({ _id: { $in: jobIds } }, { session });
        await Company.deleteMany({ createdBy: userId }, { session });
        await User.deleteOne({ _id: userId }, { session });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({ success: true, message: "User account deleted successfully" });
  } catch (error) {
    console.error("DELETE ADMIN USER ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to delete user account" });
  }
};

export const getAdminJobs = async (req, res) => {
  try {
    const { page, limit, error } = getPagination(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    if (status) {
      return res.status(400).json({ success: false, message: "Job status filtering is not supported" });
    }

    const filter = {};
    if (search) {
      const expression = { $regex: escapeRegex(search), $options: "i" };
      const companies = await Company.find({
        $or: [{ name: expression }, { location: expression }],
      }).select("_id").lean();

      filter.$or = [
        { title: expression },
        { location: expression },
        { jobType: expression },
        { experienceLevel: expression },
        { company: { $in: companies.map((company) => company._id) } },
      ];
    }

    const [total, jobs] = await Promise.all([
      Job.countDocuments(filter),
      Job.find(filter)
        .select("title location jobType salary experienceLevel company createdBy moderationStatus moderatedAt moderationReason createdAt updatedAt")
        .populate("company", "name location")
        .populate("createdBy", "fullName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: { jobs, pagination: paginationResponse(page, limit, total) },
    });
  } catch (error) {
    console.error("GET ADMIN JOBS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load jobs" });
  }
};

export const moderateAdminJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, reason } = req.body;

    if (!mongoose.isValidObjectId(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid job ID" });
    }

    if (!["active", "hidden"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid moderation status" });
    }

    if (reason !== undefined && (typeof reason !== "string" || reason.trim().length > MAX_MODERATION_REASON_LENGTH)) {
      return res.status(400).json({ success: false, message: "Moderation reason must be 500 characters or fewer" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const currentStatus = job.moderationStatus || "active";
    if (currentStatus !== status) {
      job.moderationStatus = status;
      job.moderatedAt = new Date();
      job.moderatedBy = req.user.id;
      job.moderationReason = reason?.trim() || "";
      await job.save();
    }

    return res.status(200).json({
      success: true,
      message: status === "hidden" ? "Job hidden successfully" : "Job restored successfully",
      job: {
        _id: job._id,
        title: job.title,
        moderationStatus: job.moderationStatus || "active",
        moderatedAt: job.moderatedAt || null,
        moderationReason: job.moderationReason || "",
      },
    });
  } catch (error) {
    console.error("MODERATE ADMIN JOB ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update job moderation" });
  }
};

export const getAdminApplications = async (req, res) => {
  try {
    const { page, limit, error } = getPagination(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter = {};

    if (status) {
      if (!APPLICATION_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid application status filter" });
      }
      filter.status = status;
    }

    if (search) {
      const expression = { $regex: escapeRegex(search), $options: "i" };
      const [applicants, jobs, companies] = await Promise.all([
        User.find({ $or: [{ fullName: expression }, { email: expression }] }).select("_id").lean(),
        Job.find({ $or: [{ title: expression }, { location: expression }] }).select("_id").lean(),
        Company.find({ $or: [{ name: expression }, { location: expression }] }).select("_id").lean(),
      ]);

      const companyIds = companies.map((company) => company._id);
      if (companyIds.length) {
        const companyJobs = await Job.find({ company: { $in: companyIds } }).select("_id").lean();
        jobs.push(...companyJobs);
      }

      filter.$or = [
        { applicant: { $in: applicants.map((applicant) => applicant._id) } },
        { job: { $in: jobs.map((job) => job._id) } },
      ];
    }

    const [total, applications] = await Promise.all([
      Application.countDocuments(filter),
      Application.find(filter)
        .select("job applicant status createdAt updatedAt")
        .populate("applicant", "fullName email")
        .populate({
          path: "job",
          select: "title location jobType company",
          populate: { path: "company", select: "name location" },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: { applications, pagination: paginationResponse(page, limit, total) },
    });
  } catch (error) {
    console.error("GET ADMIN APPLICATIONS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load applications" });
  }
};

export const getAdminApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;
    if (!mongoose.isValidObjectId(applicationId)) {
      return res.status(400).json({ success: false, message: "Invalid application ID" });
    }

    const application = await Application.findById(applicationId).populate([
      { path: "applicant", select: "fullName email" },
      {
        path: "job",
        select: "title company createdBy",
        populate: [
          { path: "company", select: "name createdBy", populate: { path: "createdBy", select: "fullName email" } },
          { path: "createdBy", select: "fullName email" },
        ],
      },
      { path: "statusHistory.actor", select: "fullName email" },
    ]);

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const applicant = application.applicant?.fullName || application.applicant?.email
      ? { fullName: application.applicant.fullName || "", email: application.applicant.email || "" }
      : null;
    const job = application.job || null;
    const company = job?.company?.name ? { name: job.company.name } : null;
    const employerUser = job?.createdBy || job?.company?.createdBy;
    const employer = employerUser?.fullName || employerUser?.email
      ? { fullName: employerUser.fullName || "", email: employerUser.email || "" }
      : null;

    return res.status(200).json({
      success: true,
      data: {
        _id: application._id,
        applicant,
        job: job ? { title: job.title || "", company, employer } : null,
        status: application.status,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        statusHistory: Array.isArray(application.statusHistory)
          ? application.statusHistory.map((event) => ({
            status: event.status,
            timestamp: event.timestamp,
            actor: event.actor?.fullName || event.actor?.email
              ? { fullName: event.actor.fullName || "", email: event.actor.email || "" }
              : null,
          }))
          : [],
      },
    });
  } catch (error) {
    console.error("GET ADMIN APPLICATION DETAIL ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load application details" });
  }
};
