import Activity from "../models/Activity.js";

export const logActivity = async ({
  req,
  workspaceId,
  projectId = null,
  taskId = null,
  action,
  message,
  metadata = {},
}) => {
  try {
    const activity = await Activity.create({
      workspace: workspaceId,
      project: projectId,
      task: taskId,
      user: req.userId,
      action,
      message,
      metadata,
    });

    const populatedActivity = await Activity.findById(activity._id).populate(
      "user",
      "name email avatar",
    );

    const io = req.app.get("io");

    if (io) {
      io.to(`workspace:${workspaceId}`).emit(
        "activity:new",
        populatedActivity,
      );
    }

    return populatedActivity;
  } catch (error) {
    // Activity logging should not break an otherwise successful task action.
    console.error("Activity logging error:", error.message);
    return null;
  }
};