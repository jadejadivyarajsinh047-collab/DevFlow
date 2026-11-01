import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import Workspace from "../models/Workspace.js";
import { createNotifications } from "../utils/notificationService.js";

async function getAccessibleTask(taskId, userId) {
  const task = await Task.findById(taskId);

  if (!task) {
    return { error: "Task not found.", status: 404 };
  }

  const workspace = await Workspace.findOne({
    _id: task.workspace,
    "members.user": userId,
  });

  if (!workspace) {
    return { error: "Access denied.", status: 403 };
  }

  return { task, workspace };
}

function emitCommentEvent(req, workspaceId, event, data) {
  const io = req.app.get("io");

  if (io) {
    io.to(`workspace:${workspaceId}`).emit(event, data);
  }
}

// GET COMMENTS
export const listComments = async (req, res) => {
  try {
    const result = await getAccessibleTask(
      req.params.taskId,
      req.userId,
    );

    if (result.error) {
      return res.status(result.status).json({
        message: result.error,
      });
    }

    const comments = await Comment.find({
      task: result.task._id,
    })
      .populate("author", "name email avatar")
      .sort({ createdAt: 1 });

    res.json({ comments });
  } catch (error) {
    console.error("List comments error:", error);

    res.status(500).json({
      message: "Unable to load comments.",
    });
  }
};

// CREATE COMMENT
export const createComment = async (req, res) => {
  try {
    const { content } = req.body;

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        message: "Comment cannot be empty.",
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        message: "Comment cannot exceed 2000 characters.",
      });
    }

    const result = await getAccessibleTask(
      req.params.taskId,
      req.userId,
    );

    if (result.error) {
      return res.status(result.status).json({
        message: result.error,
      });
    }

    const comment = await Comment.create({
      content: content.trim(),
      task: result.task._id,
      workspace: result.task.workspace,
      author: req.userId,
    });

    const populatedComment = await Comment.findById(comment._id).populate(
      "author",
      "name email avatar",
    );

    emitCommentEvent(
      req,
      result.workspace._id,
      "comment:created",
      {
        taskId: result.task._id.toString(),
        comment: populatedComment,
      },
    );

    // Notify the task creator and assignee.
    await createNotifications({
      req,
      recipientIds: [
        result.task.createdBy,
        result.task.assignee,
      ],
      senderId: req.userId,
      workspaceId: result.workspace._id,
      taskId: result.task._id,
      type: "task_comment",
      message: `A new comment was added to "${result.task.title}".`,
    });

    res.status(201).json({
      message: "Comment added successfully.",
      comment: populatedComment,
    });
  } catch (error) {
    console.error("Create comment error:", error);

    res.status(500).json({
      message: "Unable to add comment.",
    });
  }
};

// DELETE YOUR OWN COMMENT
export const deleteComment = async (req, res) => {
  try {
    const result = await getAccessibleTask(
      req.params.taskId,
      req.userId,
    );

    if (result.error) {
      return res.status(result.status).json({
        message: result.error,
      });
    }

    const comment = await Comment.findOne({
      _id: req.params.commentId,
      task: result.task._id,
    });

    if (!comment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    if (String(comment.author) !== String(req.userId)) {
      return res.status(403).json({
        message: "You can only delete your own comments.",
      });
    }

    const deletedCommentId = comment._id.toString();

    await comment.deleteOne();

    emitCommentEvent(
      req,
      result.workspace._id,
      "comment:deleted",
      {
        taskId: result.task._id.toString(),
        commentId: deletedCommentId,
      },
    );

    res.status(200).json({
      message: "Comment deleted successfully.",
    });
  } catch (error) {
    console.error("Delete comment error:", error);

    res.status(500).json({
      message: "Unable to delete comment.",
    });
  }
};