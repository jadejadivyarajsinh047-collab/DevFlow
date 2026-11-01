
import mongoose from "mongoose";

import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";
import Project from "../models/Project.js";

// Check whether a user belongs to a workspace.
async function getWorkspaceMembership(workspaceId, userId) {
  return Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
  }).select("_id members.user");
}

// GET workspace, project or direct messages.
export async function getMessages(req, res) {
  try {
    const { workspaceId } = req.params;
    const {
      type = "workspace",
      projectId,
      recipientId,
    } = req.query;

    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await getWorkspaceMembership(
      workspaceId,
      req.userId,
    );

    if (!workspace) {
      return res.status(403).json({
        message: "You are not a member of this workspace.",
      });
    }

    let filter = {
      workspace: workspaceId,
    };

    // Workspace chat.
    if (type === "workspace") {
      filter.type = "workspace";
    }

    // Project channel chat.
    else if (type === "project") {
      if (!projectId || !mongoose.isValidObjectId(projectId)) {
        return res.status(400).json({
          message: "A valid project ID is required.",
        });
      }

      const project = await Project.findOne({
        _id: projectId,
        workspace: workspaceId,
      }).select("_id");

      if (!project) {
        return res.status(404).json({
          message: "Project not found in this workspace.",
        });
      }

      filter.type = "project";
      filter.project = projectId;
    }

    // Private direct messages.
    else if (type === "direct") {
      if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
        return res.status(400).json({
          message: "A valid recipient ID is required.",
        });
      }

      if (String(recipientId) === String(req.userId)) {
        return res.status(400).json({
          message: "You cannot send direct messages to yourself.",
        });
      }

      const recipientIsMember = workspace.members.some(
        (member) =>
          String(member.user) === String(recipientId),
      );

      if (!recipientIsMember) {
        return res.status(403).json({
          message: "Recipient is not a member of this workspace.",
        });
      }

      filter.type = "direct";

      filter.$or = [
        {
          sender: req.userId,
          recipient: recipientId,
        },
        {
          sender: recipientId,
          recipient: req.userId,
        },
      ];
    } else {
      return res.status(400).json({
        message: "Invalid chat type.",
      });
    }

    // Fetch the latest 200 messages.
    const messages = await Message.find(filter)
      .populate("sender", "name email avatar")
      .populate("recipient", "name email avatar")
      .populate("project", "name color")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Display oldest to newest.
    messages.reverse();

    return res.status(200).json({
      messages,
    });
  } catch (error) {
    console.error("Get chat messages error:", error);

    return res.status(500).json({
      message: "Unable to load messages.",
    });
  }
}

// CREATE and send a new message.
export async function sendMessage(req, res) {
  try {
    const { workspaceId } = req.params;

    const {
      content,
      type = "workspace",
      projectId,
      recipientId,
    } = req.body;

    const cleanContent =
      typeof content === "string" ? content.trim() : "";

    if (!cleanContent) {
      return res.status(400).json({
        message: "Message cannot be empty.",
      });
    }

    if (cleanContent.length > 4000) {
      return res.status(400).json({
        message: "Message cannot exceed 4000 characters.",
      });
    }

    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    // Verify workspace membership.
    const workspace = await getWorkspaceMembership(
      workspaceId,
      req.userId,
    );

    if (!workspace) {
      return res.status(403).json({
        message: "You are not a member of this workspace.",
      });
    }

    const messageData = {
      workspace: workspaceId,
      sender: req.userId,
      content: cleanContent,
      type,
    };

    // Project channel message.
    if (type === "project") {
      if (!mongoose.isValidObjectId(projectId)) {
        return res.status(400).json({
          message: "A valid project ID is required.",
        });
      }

      const project = await Project.findOne({
        _id: projectId,
        workspace: workspaceId,
      }).select("_id");

      if (!project) {
        return res.status(404).json({
          message: "Project not found.",
        });
      }

      messageData.project = projectId;
    }

    // Direct message.
    else if (type === "direct") {
      if (
        !recipientId ||
        !mongoose.isValidObjectId(recipientId) ||
        String(recipientId) === String(req.userId)
      ) {
        return res.status(400).json({
          message: "Invalid message recipient.",
        });
      }

      const recipientIsMember = workspace.members.some(
        (member) =>
          String(member.user) === String(recipientId),
      );

      if (!recipientIsMember) {
        return res.status(403).json({
          message: "Recipient is not a workspace member.",
        });
      }

      messageData.recipient = recipientId;
    }

    // Workspace message.
    else if (type !== "workspace") {
      return res.status(400).json({
        message: "Invalid chat type.",
      });
    }

    // Save message in MongoDB.
    const message = await Message.create(messageData);

    // Get populated message information.
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email avatar")
      .populate("recipient", "name email avatar")
      .populate("project", "name color");

    const messageObject = populatedMessage.toObject();

    // Emit real-time message events.
    const io = req.app.get("io");

    if (io) {
      if (type === "direct") {
        // Send to sender's private room.
        io.to(`user:${req.userId}`).emit(
          "chat:message:new",
          messageObject,
        );

        // Send to recipient's private room.
        io.to(`user:${recipientId}`).emit(
          "chat:message:new",
          messageObject,
        );
      } else {
        // Workspace and project messages.
        io.to(`workspace:${workspaceId}`).emit(
          "chat:message:new",
          messageObject,
        );
      }
    }

    return res.status(201).json({
      message: "Message sent successfully.",
      data: messageObject,
    });
  } catch (error) {
    console.error("Send chat message error:", error);

    return res.status(500).json({
      message: "Unable to send message.",
    });
  }
}

// DELETE your own message.
export async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid message ID.",
      });
    }

    // Only the original sender can delete a message.
    const message = await Message.findOne({
      _id: messageId,
      sender: req.userId,
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found or you cannot delete it.",
      });
    }

    const workspaceId = message.workspace.toString();
    const type = message.type;
    const recipientId = message.recipient?.toString() || null;
    const projectId = message.project?.toString() || null;
    const messageIdString = message._id.toString();

    // Delete from MongoDB.
    await message.deleteOne();

    // Notify connected users.
    const io = req.app.get("io");

    if (io) {
      const deletedEvent = {
        messageId: messageIdString,
        workspaceId,
        type,
        projectId,
        senderId: String(req.userId),
        recipientId,
      };

      if (type === "direct") {
        io.to(`user:${req.userId}`).emit(
          "chat:message:deleted",
          deletedEvent,
        );

        if (recipientId) {
          io.to(`user:${recipientId}`).emit(
            "chat:message:deleted",
            deletedEvent,
          );
        }
      } else {
        io.to(`workspace:${workspaceId}`).emit(
          "chat:message:deleted",
          deletedEvent,
        );
      }
    }

    return res.status(200).json({
      message: "Message deleted successfully.",
      messageId: messageIdString,
    });
  } catch (error) {
    console.error("Delete chat message error:", error);

    return res.status(500).json({
      message: "Unable to delete message.",
    });
  }
}
