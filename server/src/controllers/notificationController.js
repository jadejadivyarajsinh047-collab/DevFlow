
import Notification from "../models/Notification.js";
import Workspace from "../models/Workspace.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET ALL NOTIFICATIONS
export const getNotifications = asyncHandler(
  async (req, res) => {
    const notifications = await Notification.find({
      recipient: req.userId,
    })
      .populate("sender", "name email avatar")
      .populate("task", "title")
      .populate("workspace", "name")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      notifications,
    });
  }
);

// GET UNREAD NOTIFICATION COUNT
export const getUnreadCount = asyncHandler(
  async (req, res) => {
    const count = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  }
);

// MARK ONE NOTIFICATION AS READ
export const markAsRead = asyncHandler(
  async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.userId,
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    res.status(200).json({
      success: true,
      notification,
    });
  }
);

// MARK ALL NOTIFICATIONS AS READ
export const markAllAsRead = asyncHandler(
  async (req, res) => {
    await Notification.updateMany(
      {
        recipient: req.userId,
        isRead: false,
      },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  }
);

// DELETE ONE NOTIFICATION
export const deleteNotification = asyncHandler(
  async (req, res) => {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.userId,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully.",
    });
  }
);

// CLEAR ALL NOTIFICATIONS
export const clearNotifications = asyncHandler(
  async (req, res) => {
    await Notification.deleteMany({
      recipient: req.userId,
    });

    res.status(200).json({
      success: true,
      message: "All notifications cleared.",
    });
  }
);
