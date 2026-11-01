
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar || "",
  notificationPreferences: user.notificationPreferences,
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({
      message: "Name, email and password are required.",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: "Password must contain at least 8 characters.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (await User.findOne({ email: normalizedEmail })) {
    return res.status(409).json({
      message: "An account with this email already exists.",
    });
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
  });

  res.status(201).json({
    token: createToken(user._id),
    user: publicUser(user),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({
    email: email?.toLowerCase().trim(),
  });

  if (!user || !(await bcrypt.compare(password || "", user.password))) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  res.json({
    token: createToken(user._id),
    user: publicUser(user),
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select("-password");

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ user: publicUser(user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, avatar } = req.body;

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({
      message: "Name and email are required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await User.findOne({
    email: normalizedEmail,
    _id: { $ne: req.userId },
  });

  if (existingUser) {
    return res.status(409).json({
      message: "This email is already registered.",
    });
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    {
      name: name.trim(),
      email: normalizedEmail,
      avatar: typeof avatar === "string" ? avatar.trim() : "",
    },
    { new: true, runValidators: true },
  );

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({
    message: "Profile updated successfully.",
    user: publicUser(user),
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: "Both passwords are required.",
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      message: "New password must contain at least 8 characters.",
    });
  }

  const user = await User.findById(req.userId);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const validPassword = await bcrypt.compare(
    currentPassword,
    user.password,
  );

  if (!validPassword) {
    return res.status(400).json({
      message: "Current password is incorrect.",
    });
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({ message: "Password changed successfully." });
});

export const updateNotifications = asyncHandler(async (req, res) => {
  const allowedFields = [
    "taskUpdates",
    "comments",
    "mentions",
    "workspaceUpdates",
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (typeof req.body[field] === "boolean") {
      updates[`notificationPreferences.${field}`] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      message: "No valid notification preferences were provided.",
    });
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({
    message: "Notification preferences saved.",
    preferences: user.notificationPreferences,
  });
});
