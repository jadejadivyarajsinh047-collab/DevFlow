import Notification from "../models/Notification.js";

export async function createNotifications({
  req,
  recipientIds = [],
  senderId,
  workspaceId,
  taskId = null,
  type,
  message,
}) {
  try {
    // Remove duplicate recipients and exclude the person performing the action.
    const uniqueRecipients = [
      ...new Set(
        recipientIds
          .filter(Boolean)
          .map((id) => String(id))
          .filter((id) => id !== String(senderId)),
      ),
    ];

    if (uniqueRecipients.length === 0) return;

    const io = req.app.get("io");

    for (const recipientId of uniqueRecipients) {
      const notification = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        workspace: workspaceId,
        task: taskId,
        type,
        message,
      });

      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("sender", "name email avatar")
        .populate("task", "title")
        .populate("workspace", "name");

      // Send the notification only to its recipient's connected sockets.
      if (io && populatedNotification) {
        io.to(`user:${recipientId}`).emit(
          "notification:new",
          populatedNotification,
        );
      }
    }
  } catch (error) {
    // Notification failure should not cancel an otherwise successful task action.
    console.error("Notification creation error:", error);
  }
}