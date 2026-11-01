
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import Workspace from "../models/Workspace.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createNotifications } from "../utils/notificationService.js";
import { logActivity } from "../utils/activityService.js";

const populateTask = (query) =>
  query
    .populate("project", "name status color")
    .populate("assignee", "name email avatar");

const emitTaskEvent = (req, workspaceId, event, data) => {
  const io = req.app.get("io");

  if (io) {
    io.to(`workspace:${workspaceId}`).emit(event, data);
  }
};

// GET ALL TASKS
export const listTasks = asyncHandler(async (req, res) => {
  const { workspaceId, projectId } = req.query;

  if (!workspaceId) {
    return res.status(400).json({
      message: "Workspace ID is required.",
    });
  }

  const workspace = await Workspace.findOne({
    _id: workspaceId,
    "members.user": req.userId,
  });

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or access denied.",
    });
  }

  const filter = {
    workspace: workspace._id,
  };

  if (projectId) {
    const project = await Project.findOne({
      _id: projectId,
      workspace: workspace._id,
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found in this workspace.",
      });
    }

    filter.project = project._id;
  }

  const tasks = await populateTask(
    Task.find(filter).sort({ updatedAt: -1 }),
  );

  res.status(200).json({
    success: true,
    count: tasks.length,
    tasks,
  });
});

// CREATE TASK
export const createTask = asyncHandler(async (req, res) => {
  const {
    title,
    projectId,
    status,
    priority,
    description,
    dueDate,
    assignee,
  } = req.body;

  if (!title?.trim() || !projectId) {
    return res.status(400).json({
      message: "Task title and project are required.",
    });
  }

  const project = await Project.findById(projectId);

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

  // Only workspace members can be assigned tasks.
  if (assignee) {
    const isMember = workspace.members.some(
      (member) => String(member.user) === String(assignee),
    );

    if (!isMember) {
      return res.status(400).json({
        message: "Assignee must be a workspace member.",
      });
    }
  }

  const task = await Task.create({
    title: title.trim(),
    description: description || "",
    project: project._id,
    workspace: workspace._id,
    createdBy: req.userId,
    status: status || "To do",
    priority: priority || "Medium",
    dueDate: dueDate || null,
    ...(assignee ? { assignee } : {}),
  });

  const populatedTask = await populateTask(
    Task.findById(task._id),
  );

  emitTaskEvent(req, workspace._id, "task:created", {
    task: populatedTask,
  });

  // Notify the assigned member.
  if (assignee) {
    await createNotifications({
      req,
      recipientIds: [assignee],
      senderId: req.userId,
      workspaceId: workspace._id,
      taskId: task._id,
      type: "task_assigned",
      message: `You were assigned the task "${task.title}".`,
    });
  }

  // Log task creation.
  await logActivity({
    req,
    workspaceId: workspace._id,
    projectId: project._id,
    taskId: task._id,
    action: "task_created",
    message: `Created task "${task.title}".`,
    metadata: {
      title: task.title,
      status: task.status,
      priority: task.priority,
    },
  });

  res.status(201).json({
    success: true,
    message: "Task created successfully.",
    task: populatedTask,
  });
});

// UPDATE TASK
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      message: "Task not found.",
    });
  }

  const workspace = await Workspace.findOne({
    _id: task.workspace,
    "members.user": req.userId,
  });

  if (!workspace) {
    return res.status(403).json({
      message: "Access denied.",
    });
  }

  // Save previous values before updating.
  const previousAssignee = task.assignee
    ? String(task.assignee)
    : null;

  const previousStatus = task.status;
  const previousTitle = task.title;
  const previousDescription = task.description;
  const previousPriority = task.priority;
  const previousDueDate = task.dueDate
    ? new Date(task.dueDate).getTime()
    : null;

  const allowedFields = [
    "title",
    "description",
    "status",
    "priority",
    "dueDate",
  ];

  allowedFields.forEach((key) => {
    if (req.body[key] !== undefined) {
      task[key] = req.body[key];
    }
  });

  // Allow assigning or unassigning a task during an update.
  if (req.body.assignee !== undefined) {
    const newAssignee = req.body.assignee || null;

    if (newAssignee) {
      const isMember = workspace.members.some(
        (member) => String(member.user) === String(newAssignee),
      );

      if (!isMember) {
        return res.status(400).json({
          message: "Assignee must be a workspace member.",
        });
      }
    }

    task.assignee = newAssignee;
  }

  await task.save();

  const updatedTask = await populateTask(
    Task.findById(task._id),
  );

  emitTaskEvent(req, workspace._id, "task:updated", {
    task: updatedTask,
  });

  const currentAssignee = task.assignee
    ? String(task.assignee)
    : null;

  const assignmentChanged = previousAssignee !== currentAssignee;

  // Log status changes.
  if (previousStatus !== task.status) {
    await logActivity({
      req,
      workspaceId: workspace._id,
      projectId: task.project,
      taskId: task._id,
      action: "task_status_changed",
      message: `Changed task "${task.title}" from "${previousStatus}" to "${task.status}".`,
      metadata: {
        oldStatus: previousStatus,
        newStatus: task.status,
      },
    });
  }

  // Log assignment or unassignment.
  if (assignmentChanged) {
    await logActivity({
      req,
      workspaceId: workspace._id,
      projectId: task.project,
      taskId: task._id,
      action: currentAssignee
        ? "task_assigned"
        : "task_unassigned",
      message: currentAssignee
        ? `Assigned task "${task.title}" to a team member.`
        : `Removed the assignee from task "${task.title}".`,
      metadata: {
        previousAssignee,
        newAssignee: currentAssignee,
      },
    });
  }

  // Detect other updated fields.
  const changedFields = [];

  if (previousTitle !== task.title) {
    changedFields.push("title");
  }

  if (previousDescription !== task.description) {
    changedFields.push("description");
  }

  if (previousPriority !== task.priority) {
    changedFields.push("priority");
  }

  const currentDueDate = task.dueDate
    ? new Date(task.dueDate).getTime()
    : null;

  if (previousDueDate !== currentDueDate) {
    changedFields.push("dueDate");
  }

  // Log other task updates.
  if (changedFields.length > 0) {
    await logActivity({
      req,
      workspaceId: workspace._id,
      projectId: task.project,
      taskId: task._id,
      action: "task_updated",
      message: `Updated ${changedFields.join(", ")} in task "${task.title}".`,
      metadata: {
        changedFields,
      },
    });
  }

  // Notify the new assignee when assignment changes.
  if (assignmentChanged && currentAssignee) {
    await createNotifications({
      req,
      recipientIds: [currentAssignee],
      senderId: req.userId,
      workspaceId: workspace._id,
      taskId: task._id,
      type: "task_assigned",
      message: `You were assigned the task "${task.title}".`,
    });
  }

  // Notify the task creator and existing assignee about the update.
  const updateRecipients = [task.createdBy, previousAssignee];

  // Avoid duplicate notification to the newly assigned member.
  if (assignmentChanged && currentAssignee) {
    const newAssigneeIndex = updateRecipients.findIndex(
      (id) => String(id) === currentAssignee,
    );

    if (newAssigneeIndex !== -1) {
      updateRecipients.splice(newAssigneeIndex, 1);
    }
  }

  await createNotifications({
    req,
    recipientIds: updateRecipients,
    senderId: req.userId,
    workspaceId: workspace._id,
    taskId: task._id,
    type: "task_updated",
    message: `The task "${task.title}" was updated.`,
  });

  res.status(200).json({
    success: true,
    message: "Task updated successfully.",
    task: updatedTask,
  });
});

// DELETE TASK
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      message: "Task not found.",
    });
  }

  const workspace = await Workspace.findOne({
    _id: task.workspace,
    "members.user": req.userId,
  });

  if (!workspace) {
    return res.status(403).json({
      message: "Access denied.",
    });
  }

  const member = workspace.members.find(
    (item) => String(item.user) === String(req.userId),
  );

  const role = member?.role;

  const isOwner = String(workspace.owner) === String(req.userId);
  const isAdmin = role === "Admin";
  const isTaskCreator = String(task.createdBy) === String(req.userId);

  // Owner and Admin can delete any task.
  // Other members can delete only tasks they created.
  if (!isOwner && !isAdmin && !isTaskCreator) {
    return res.status(403).json({
      message: "Members can only delete tasks they created.",
    });
  }

  const deletedTaskId = task._id.toString();
  const deletedProjectId = task.project.toString();
  const taskTitle = task.title;

  // Notify creator and assignee before deleting the task.
  await createNotifications({
    req,
    recipientIds: [task.createdBy, task.assignee],
    senderId: req.userId,
    workspaceId: workspace._id,
    taskId: null,
    type: "task_deleted",
    message: `The task "${taskTitle}" was deleted.`,
  });

  // Log deletion before removing the task.
  await logActivity({
    req,
    workspaceId: workspace._id,
    projectId: deletedProjectId,
    taskId: deletedTaskId,
    action: "task_deleted",
    message: `Deleted task "${taskTitle}".`,
    metadata: {
      title: taskTitle,
    },
  });

  await task.deleteOne();

  emitTaskEvent(req, workspace._id, "task:deleted", {
    taskId: deletedTaskId,
    projectId: deletedProjectId,
  });

  return res.status(200).json({
    success: true,
    message: "Task deleted successfully.",
  });
});
