
import mongoose from "mongoose";

import Workspace from "../models/Workspace.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Comment from "../models/Comment.js";
import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import Message from "../models/Message.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { createNotifications } from "../utils/notificationService.js";

export const listWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await Workspace.find({
    "members.user": req.userId,
  }).sort({ updatedAt: -1 });

  res.json({ workspaces });
});

export const createWorkspace = asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({
      message: "Workspace name is required.",
    });
  }

  const workspace = await Workspace.create({
    name,
    description: req.body.description || "",
    owner: req.userId,
    members: [{ user: req.userId, role: "Owner" }],
  });

  res.status(201).json({ workspace });
});

async function getWorkspaceForMember(workspaceId, userId) {
  if (!mongoose.isValidObjectId(workspaceId)) {
    return null;
  }

  return Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
  });
}

function getMemberRole(workspace, userId) {
  const member = workspace.members.find(
    (item) => item.user.toString() === userId.toString(),
  );

  return member?.role;
}

function canManageMembers(workspace, userId) {
  return ["Owner", "Admin"].includes(
    getMemberRole(workspace, userId),
  );
}

// GET WORKSPACE DETAILS
export const getWorkspaceDetails = asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForMember(
    req.params.id,
    req.userId,
  );

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or access denied.",
    });
  }

  res.json({ workspace });
});

// UPDATE WORKSPACE
export const updateWorkspace = asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForMember(
    req.params.id,
    req.userId,
  );

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or access denied.",
    });
  }

  if (!canManageMembers(workspace, req.userId)) {
    return res.status(403).json({
      message: "Only Owners and Admins can update workspace details.",
    });
  }

  const { name, description } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      message: "Workspace name is required.",
    });
  }

  if (name.trim().length > 100) {
    return res.status(400).json({
      message: "Workspace name cannot exceed 100 characters.",
    });
  }

  if (
    description !== undefined &&
    typeof description !== "string"
  ) {
    return res.status(400).json({
      message: "Workspace description must be text.",
    });
  }

  workspace.name = name.trim();

  if (description !== undefined) {
    workspace.description = description.trim();
  }

  await workspace.save();

  res.json({
    message: "Workspace updated successfully.",
    workspace,
  });
});

// DELETE WORKSPACE
export const deleteWorkspace = asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForMember(
    req.params.id,
    req.userId,
  );

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or access denied.",
    });
  }

  if (workspace.owner.toString() !== req.userId.toString()) {
    return res.status(403).json({
      message: "Only the workspace Owner can delete this workspace.",
    });
  }

  const workspaceId = workspace._id;

  // Remove dependent records before removing their parent records.
  await Comment.deleteMany({ workspace: workspaceId });
  await Message.deleteMany({ workspace: workspaceId });
  await Task.deleteMany({ workspace: workspaceId });
  await Activity.deleteMany({ workspace: workspaceId });
  await Notification.deleteMany({ workspace: workspaceId });
  await Project.deleteMany({ workspace: workspaceId });

  await Workspace.deleteOne({ _id: workspaceId });

  res.json({
    success: true,
    message: "Workspace and its related data deleted successfully.",
    deletedWorkspaceId: workspaceId,
  });
});

// LIST WORKSPACE MEMBERS
export const listWorkspaceMembers = asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForMember(
    req.params.id,
    req.userId,
  );

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or access denied.",
    });
  }

  const populated = await Workspace.findById(workspace._id).populate(
    "members.user",
    "name email avatar",
  );

  res.json({
    members: populated.members,
    owner: populated.owner,
  });
});

// ADD WORKSPACE MEMBER
export const addWorkspaceMember = asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForMember(
    req.params.id,
    req.userId,
  );

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or access denied.",
    });
  }

  if (!canManageMembers(workspace, req.userId)) {
    return res.status(403).json({
      message: "Only workspace Owners and Admins can invite members.",
    });
  }

  const email = req.body.email?.toLowerCase().trim();
  const requestedRole = req.body.role || "Member";

  if (!email) {
    return res.status(400).json({
      message: "Member email is required.",
    });
  }

  if (
    !["Admin", "Manager", "Member", "Viewer"].includes(requestedRole)
  ) {
    return res.status(400).json({
      message: "Invalid member role.",
    });
  }

  const currentRole = getMemberRole(workspace, req.userId);

  if (currentRole === "Admin" && requestedRole === "Admin") {
    return res.status(403).json({
      message: "Only the workspace Owner can assign the Admin role.",
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      message:
        "No registered user found with this email. Ask them to register first.",
    });
  }

  const alreadyMember = workspace.members.some(
    (item) => item.user.toString() === user._id.toString(),
  );

  if (alreadyMember) {
    return res.status(409).json({
      message: "This user is already a workspace member.",
    });
  }

  workspace.members.push({
    user: user._id,
    role: requestedRole,
  });

  await workspace.save();

  await createNotifications({
    req,
    recipientIds: [user._id],
    senderId: req.userId,
    workspaceId: workspace._id,
    type: "workspace_invitation",
    message: `You were added to the workspace "${workspace.name}".`,
  });

  const updatedWorkspace = await Workspace.findById(
    workspace._id,
  ).populate("members.user", "name email avatar");

  res.status(201).json({
    success: true,
    message: "Member added successfully.",
    members: updatedWorkspace.members,
  });
});

// REMOVE WORKSPACE MEMBER
export const removeWorkspaceMember = asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForMember(
    req.params.id,
    req.userId,
  );

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or access denied.",
    });
  }

  if (!canManageMembers(workspace, req.userId)) {
    return res.status(403).json({
      message: "Only workspace Owners and Admins can remove members.",
    });
  }

  const target = workspace.members.find(
    (item) => item.user.toString() === req.params.userId,
  );

  if (!target) {
    return res.status(404).json({
      message: "Workspace member not found.",
    });
  }

  if (target.role === "Owner") {
    return res.status(403).json({
      message: "The workspace Owner cannot be removed.",
    });
  }

  const currentRole = getMemberRole(workspace, req.userId);

  if (currentRole === "Admin" && target.role === "Admin") {
    return res.status(403).json({
      message: "An Admin cannot remove another Admin.",
    });
  }

  workspace.members = workspace.members.filter(
    (item) => item.user.toString() !== req.params.userId,
  );

  await workspace.save();

  res.json({
    message: "Member removed successfully.",
  });
});
