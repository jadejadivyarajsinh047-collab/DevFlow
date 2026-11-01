import Project from "../models/Project.js";
import Workspace from "../models/Workspace.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return res.status(404).json({
      message: "Project not found.",
    });
  }

  const workspace = await Workspace.findOne({
    _id: project.workspace,
    "members.user": req.userId,
  });

  if (!workspace) {
    return res.status(403).json({
      message: "Access denied.",
    });
  }

  res.json({ project });
});

export const listProjects = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findOne({
    _id: req.params.workspaceId,
    "members.user": req.userId,
  });
  if (!workspace)
    return res.status(404).json({ message: "Workspace not found." });
  const projects = await Project.find({ workspace: workspace._id }).sort({
    updatedAt: -1,
  });
  res.json({ projects });
});

export const createProject = asyncHandler(async (req, res) => {
  const { name, description, workspaceId, priority, dueDate, color } = req.body;
  if (!name?.trim() || !workspaceId)
    return res
      .status(400)
      .json({ message: "Project name and workspace are required." });
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    "members.user": req.userId,
  });
  if (!workspace)
    return res.status(404).json({ message: "Workspace not found." });
  const project = await Project.create({
    name: name.trim(),
    description,
    workspace: workspaceId,
    createdBy: req.userId,
    priority,
    dueDate: dueDate || null,
    color,
  });
  res.status(201).json({ project });
});

export const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found." });
  const workspace = await Workspace.findOne({
    _id: project.workspace,
    "members.user": req.userId,
  });
  if (!workspace) return res.status(403).json({ message: "Access denied." });
  const allowed = [
    "name",
    "description",
    "status",
    "priority",
    "dueDate",
    "color",
  ];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) project[key] = req.body[key];
  });
  await project.save();
  res.json({ project });
});

export const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found." });
  const workspace = await Workspace.findOne({
    _id: project.workspace,
    owner: req.userId,
  });
  if (!workspace)
    return res
      .status(403)
      .json({ message: "Only the workspace owner can delete this project." });
  await project.deleteOne();
  res.json({ message: "Project deleted." });
});
