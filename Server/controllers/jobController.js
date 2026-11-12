import Job from "../models/Job.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import Application from "../models/Application.js";
import mongoose from "mongoose";
import { scoreJobForSkills, uniqueSkills } from "../utils/recommendationScoring.js";

const toCaseInsensitiveSearch = (value) => ({
  $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  $options: "i",
});

const toExperienceFilter = (value) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  const years = normalized.match(/^(\d+)\s*(?:yr|yrs|year|years)(?:\s+experience)?$/i);

  if (years) {
    return {
      $regex: `^${years[1]}\\s*(?:yr|yrs|year|years)(?:\\s+experience)?$`,
      $options: "i",
    };
  }

  return {
    $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}$`,
    $options: "i",
  };
};

const normalizeSalary = (salary) => {
  if (typeof salary === "string") return salary.trim() || null;
  return salary ?? null;
};

const allowedJobTypes = ["Full-time", "Part-time", "Internship", "Remote"];
const isNonEmptyString = (value) => typeof value === "string" && Boolean(value.trim());

// ================= CREATE JOB =================
export const createJob = async (req, res) => {
  try {
    // Only employers can create jobs
    if (req.user.role !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only employers can create jobs",
      });
    }

    const {
      title,
      description,
      requirements,
      salary,
      companyName,
      location,
      experienceLevel,
      jobType,
    } = req.body;

    if (!isNonEmptyString(title)) {
      return res.status(400).json({
        success: false,
        message: "Job title is required",
      });
    }

    if (!isNonEmptyString(description)) {
      return res.status(400).json({
        success: false,
        message: "Job description is required",
      });
    }

    if (!isNonEmptyString(companyName)) {
      return res.status(400).json({ success: false, message: "Company is required" });
    }

    if (!isNonEmptyString(location)) {
      return res.status(400).json({ success: false, message: "Location is required" });
    }

    if (!isNonEmptyString(experienceLevel)) {
      return res.status(400).json({ success: false, message: "Experience is required" });
    }

    if (!allowedJobTypes.includes(jobType)) {
      return res.status(400).json({ success: false, message: "Invalid job type" });
    }

    if (!Array.isArray(requirements) || requirements.length === 0 || requirements.some((item) => !isNonEmptyString(item))) {
      return res.status(400).json({ success: false, message: "At least one requirement is required" });
    }

    if (salary !== undefined && typeof salary !== "string" && typeof salary !== "number" && salary !== null) {
      return res.status(400).json({ success: false, message: "Salary must be a string or number" });
    }
    const normalizedSalary = normalizeSalary(salary);

    let company = await Company.findOne({ createdBy: req.user.id });

    if (!company) {
      company = await Company.create({
        name: companyName.trim(),
        location: location.trim(),
        createdBy: req.user.id,
      });
      await User.findByIdAndUpdate(req.user.id, { company: company._id });
    }

    // Create Job
    const job = await Job.create({
      title: title.trim(),
      description: description.trim(),
      requirements: Array.isArray(requirements)
        ? requirements.map((item) => item.trim())
        : [],
      salary: normalizedSalary,
      location: location.trim(),
      experienceLevel: experienceLevel.trim(),
      jobType,
      company: company._id,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error("CREATE JOB ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to create job",
    });
  }
};
// ================= GET ALL JOBS =================
export const getAllJobs = async (req, res) => {
  try {
    const { search = "", location = "", jobType = "", experience = "" } =
      req.query;
    if (![search, location, jobType, experience].every((value) => typeof value === "string")) {
      return res.status(400).json({ success: false, message: "Search filters must be strings" });
    }
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    const filter = { moderationStatus: { $ne: "hidden" } };

    if (location.trim()) {
      filter.location = toCaseInsensitiveSearch(location.trim());
    }

    if (jobType.trim()) {
      filter.jobType = jobType.trim();
    }

    if (experience.trim()) {
      filter.experienceLevel = toExperienceFilter(experience);
    }

    if (search.trim()) {
      const searchExpression = toCaseInsensitiveSearch(search.trim());
      const companies = await Company.find({
        $or: [
          { name: searchExpression },
          { description: searchExpression },
          { location: searchExpression },
        ],
      }).select("_id");

      filter.$or = [
        { title: searchExpression },
        { description: searchExpression },
        { requirements: searchExpression },
        { location: searchExpression },
        { jobType: searchExpression },
        { experienceLevel: searchExpression },
        { company: { $in: companies.map((company) => company._id) } },
      ];
    }

    const total = await Job.countDocuments(filter);
    const jobs = await Job.find(filter)
      .populate("company", "name location logo")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: jobs.length,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
      jobs,
    });
  } catch (error) {
    console.error("GET JOBS ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ================= GET SINGLE JOB =================
export const getJobById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const job = await Job.findById(req.params.id)
      .populate("company", "name description website location logo");

    if (!job || job.moderationStatus === "hidden") {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("GET JOB ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
// ================= UPDATE JOB =================
export const updateJob = async (req, res) => {
  try {
    // Only employers can update jobs
    if (req.user.role !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only employers can update jobs",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid job ID" });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Check ownership
    if (job.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can update only your own jobs",
      });
    }

    const {
      title,
      description,
      requirements,
      salary,
      location,
      experienceLevel,
      jobType,
    } = req.body;

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return res.status(400).json({ success: false, message: "Job title cannot be empty" });
    }

    if (description !== undefined && (typeof description !== "string" || !description.trim())) {
      return res.status(400).json({ success: false, message: "Job description cannot be empty" });
    }

    if (requirements !== undefined && (!Array.isArray(requirements)
      || requirements.length === 0
      || requirements.some((item) => typeof item !== "string" || !item.trim()))) {
      return res.status(400).json({ success: false, message: "At least one requirement is required" });
    }

    if (location !== undefined && (typeof location !== "string" || !location.trim())) {
      return res.status(400).json({ success: false, message: "Location cannot be empty" });
    }

    if (experienceLevel !== undefined && (typeof experienceLevel !== "string" || !experienceLevel.trim())) {
      return res.status(400).json({ success: false, message: "Experience cannot be empty" });
    }

    if (jobType !== undefined && !allowedJobTypes.includes(jobType)) {
      return res.status(400).json({ success: false, message: "Invalid job type" });
    }

    if (salary !== undefined && typeof salary !== "string" && typeof salary !== "number" && salary !== null) {
      return res.status(400).json({ success: false, message: "Salary must be a string or number" });
    }

    if (title !== undefined) job.title = title.trim();
    if (description !== undefined) job.description = description.trim();

    if (requirements !== undefined) {
      job.requirements = Array.isArray(requirements)
        ? requirements.map((item) => item.trim())
        : [];
    }

    if (salary !== undefined) {
      job.salary = normalizeSalary(salary);
    }
    if (location !== undefined) job.location = location.trim();

    if (experienceLevel !== undefined) {
      job.experienceLevel = experienceLevel.trim();
    }

    if (jobType !== undefined) job.jobType = jobType;

    await job.save();

    res.status(200).json({
      success: true,
      message: "Job updated successfully",
      job,
    });

  } catch (error) {
    console.error("UPDATE JOB ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to update job",
    });
  }
};

// ================= DELETE JOB =================
export const deleteJob = async (req, res) => {
  try {
    // Only employers can delete jobs
    if (req.user.role !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only employers can delete jobs",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid job ID" });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Check ownership
    if (job.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can delete only your own jobs",
      });
    }

    await Job.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });

  } catch (error) {
    console.error("DELETE JOB ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to delete job",
    });
  }
};

export const getMyJobs = async (req, res) => {
  try {
    if (req.user.role !== "employer") {
      return res.status(403).json({ success: false, message: "Access denied. Only employers can view these jobs" });
    }

    const jobs = await Job.find({ createdBy: req.user.id })
      .populate("company", "name location logo")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: jobs.length, jobs });
  } catch (error) {
    console.error("GET MY JOBS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load your jobs" });
  }
};

// ================= CANDIDATE JOB RECOMMENDATIONS =================
export const getJobRecommendations = async (req, res) => {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ success: false, message: "Only candidates can view job recommendations" });
    }

    const candidate = await User.findById(req.user.id).select("skills");
    if (!candidate) {
      return res.status(404).json({ success: false, message: "Candidate profile not found" });
    }

    let skills = uniqueSkills(candidate.skills);
    let skillsSource = "profile";
    if (!skills.length) {
      const analysis = await ResumeAnalysis.findOne({ user: req.user.id }).select("extractedSkills");
      skills = uniqueSkills(analysis?.extractedSkills);
      skillsSource = skills.length ? "resume analysis" : null;
    }

    if (!skills.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        recommendations: [],
        message: "Add skills to your profile or analyze your resume to receive recommendations.",
        needsSkills: true,
      });
    }

    const [jobs, applications] = await Promise.all([
      Job.find({ moderationStatus: { $ne: "hidden" } }).populate("company", "name location logo").sort({ createdAt: -1 }),
      Application.find({ applicant: req.user.id }).select("job"),
    ]);
    const appliedJobIds = new Set(applications.map((application) => String(application.job)));
    const recommendations = jobs
      .filter((job) => !appliedJobIds.has(String(job._id)))
      .map((job) => {
        const { score, matchedSkills, reasons } = scoreJobForSkills(skills, job);
        return {
          job: {
            _id: job._id,
            title: job.title,
            location: job.location,
            jobType: job.jobType,
            experienceLevel: job.experienceLevel,
            company: job.company ? {
              _id: job.company._id,
              name: job.company.name,
              location: job.company.location,
              logo: job.company.logo,
            } : null,
            createdAt: job.createdAt,
          },
          score,
          matchedSkills,
          reasons,
        };
      })
      .filter((recommendation) => recommendation.score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.job.createdAt) - new Date(a.job.createdAt))
      .slice(0, 20);

    return res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations,
      skillsSource,
      message: recommendations.length
        ? "Recommendations are based on skills found in job titles, requirements, and descriptions."
        : "No un-applied jobs currently match your saved skills.",
      needsSkills: false,
    });
  } catch (error) {
    console.error("GET JOB RECOMMENDATIONS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load job recommendations" });
  }
};
