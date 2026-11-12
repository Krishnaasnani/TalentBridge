import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ================= REGISTER USER =================
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Check required fields
    if (typeof fullName !== "string" || typeof email !== "string" || typeof password !== "string" || !fullName.trim() || !email.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address" });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters" });
    }

    const publicRoles = ["candidate", "employer"];
    const userRole = role || "candidate";

    if (!publicRoles.includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: userRole,
    });

    // Remove password from response
    user.password = undefined;

    return res.status(201).json({
      success: true,
      message: "Registration Successful",
      user,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
// ================= LOGIN USER =================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail.length > 254 || password.length > 128) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    // Find user and include password
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    // User not found
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    // Remove password from response
    user.password = undefined;

    return res.status(200).json({
      success: true,
      message: "Login Successful",
      token,
      user,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
