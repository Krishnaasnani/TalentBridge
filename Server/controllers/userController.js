import User from "../models/User.js";
import cloudinary from "../config/cloudinary.js";

const getCloudinaryRawPublicId = (resumeUrl) => {
  const match = new URL(resumeUrl).pathname.match(
    /\/raw\/upload\/(?:v\d+\/)?(.+)$/,
  );
  return match ? decodeURIComponent(match[1]) : "";
};

// ================= GET USER PROFILE =================


export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const getMyResume = async (req, res) => {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ success: false, message: "Only candidates can view their resumes." });
    }

    const user = await User.findById(req.user.id).select("resume");
    if (!user || !user.resume) {
      return res.status(404).json({ success: false, message: "Resume not available." });
    }

    const publicId = getCloudinaryRawPublicId(user.resume);
    const format = publicId.split(".").pop()?.toLowerCase();
    if (!publicId || !["pdf", "doc", "docx"].includes(format)) {
      return res.status(404).json({ success: false, message: "Resume not available." });
    }

    const signedResumeUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: "raw",
      type: "upload",
      expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const resumeResponse = await fetch(signedResumeUrl);
    if (!resumeResponse.ok) {
      return res.status(502).json({ success: false, message: "Unable to retrieve the resume." });
    }

    const resumeBuffer = Buffer.from(await resumeResponse.arrayBuffer());
    res.set("Content-Type", resumeResponse.headers.get("content-type") || "application/octet-stream");
    res.set("Content-Disposition", "inline");
    return res.send(resumeBuffer);
  } catch (error) {
    console.error("GET MY RESUME ERROR:", error.message);
    return res.status(502).json({ success: false, message: "Unable to retrieve the resume." });
  }
};

// ================= UPDATE USER PROFILE =================
export const updateProfile = async (req, res) => {
  try {
    let { fullName, phone, location, bio, skills, profileImage } =
      req.body;

    if (typeof skills === "string") {
      try {
        skills = JSON.parse(skills);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Skills must be an array of strings",
        });
      }
    }

    if (
      fullName === undefined &&
      phone === undefined &&
      location === undefined &&
      bio === undefined &&
      skills === undefined &&
      profileImage === undefined &&
      !req.file
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one field to update",
      });
    }

    if (fullName !== undefined && !String(fullName).trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name cannot be empty",
      });
    }

    if (
      skills !== undefined &&
      (!Array.isArray(skills) || skills.some((skill) => typeof skill !== "string"))
    ) {
      return res.status(400).json({
        success: false,
        message: "Skills must be an array of strings",
      });
    }

    const allowedUpdates = {};
    // multer-storage-cloudinary sets path to Cloudinary's HTTPS secure_url.
    if (req.file) {
      if (!req.file.path || !req.file.path.startsWith("https://")) {
        return res.status(502).json({
          success: false,
          message: "Unable to create a resume link. Please try again.",
        });
      }
      allowedUpdates.resume = req.file.path;
    }

    if (fullName !== undefined) allowedUpdates.fullName = String(fullName).trim();
    if (phone !== undefined) allowedUpdates.phone = String(phone).trim();
    if (location !== undefined) allowedUpdates.location = String(location).trim();
    if (bio !== undefined) allowedUpdates.bio = String(bio).trim();
    if (skills !== undefined) {
      allowedUpdates.skills = skills.map((skill) => skill.trim()).filter(Boolean);
    }
    if (profileImage !== undefined)
      allowedUpdates.profileImage = String(profileImage).trim();

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: allowedUpdates },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: req.file ? "Resume uploaded successfully." : "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
