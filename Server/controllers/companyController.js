import Company from "../models/Company.js";
import User from "../models/User.js";

const isNonEmptyString = (value) => typeof value === "string" && Boolean(value.trim());
const isOptionalString = (value) => value === undefined || typeof value === "string";

// ================= CREATE COMPANY =================
export const createCompany = async (req, res) => {
  try {
    // Employer-only: role is embedded in JWT by loginUser
    if (req.user.role !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only employers can create a company",
      });
    }

    const { name, description, website, location, logo } = req.body;

    // Company name is the only required field
    if (!isNonEmptyString(name)) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    if (![description, website, location, logo].every(isOptionalString)) {
      return res.status(400).json({ success: false, message: "Company details must be strings" });
    }

    // One employer — one company
    const existingCompany = await Company.findOne({ createdBy: req.user.id });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: "You have already created a company. Use update instead",
      });
    }

    // Create company
    const company = await Company.create({
      name: name.trim(),
      description: description?.trim() || "",
      website: website?.trim() || "",
      location: location?.trim() || "",
      logo: logo?.trim() || "",
      createdBy: req.user.id,
    });

    // Link company to the employer's user record
    await User.findByIdAndUpdate(req.user.id, { company: company._id });

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      company,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ================= GET MY COMPANY =================
export const getMyCompany = async (req, res) => {
  try {
    // Find the company that belongs to the logged-in employer
    const company = await Company.findOne({ createdBy: req.user.id }).populate(
      "createdBy",
      "fullName email",
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "No company found. Please create one first",
      });
    }

    res.status(200).json({
      success: true,
      company,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ================= UPDATE COMPANY =================
export const updateCompany = async (req, res) => {
  try {
    // Find company by route param
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Ownership check — only the employer who created it can update it
    if (company.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update your own company",
      });
    }

    const { name, description, website, location, logo } = req.body;

    // At least one field must be provided
    if (
      name === undefined &&
      description === undefined &&
      website === undefined &&
      location === undefined &&
      logo === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one field to update",
      });
    }

    // Validate name is not set to an empty string
    if (name !== undefined && !isNonEmptyString(name)) {
      return res.status(400).json({
        success: false,
        message: "Company name cannot be empty",
      });
    }

    if (![description, website, location, logo].every(isOptionalString)) {
      return res.status(400).json({ success: false, message: "Company details must be strings" });
    }

    // Build update object from only the fields that were sent
    const allowedUpdates = {};

    if (name !== undefined) allowedUpdates.name = name.trim();
    if (description !== undefined)
      allowedUpdates.description = description.trim();
    if (website !== undefined) allowedUpdates.website = website.trim();
    if (location !== undefined) allowedUpdates.location = location.trim();
    if (logo !== undefined) allowedUpdates.logo = logo.trim();

    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: allowedUpdates },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Company updated successfully",
      company: updatedCompany,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
