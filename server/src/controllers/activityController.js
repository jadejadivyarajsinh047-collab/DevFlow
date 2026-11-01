import Activity from "../models/Activity.js";
import Workspace from "../models/Workspace.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getActivities = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  const workspace = await Workspace.findOne({
    _id: workspaceId,
    "members.user": req.userId,
  });

  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: "Workspace not found or access denied.",
    });
  }

  const activities = await Activity.find({
    workspace: workspace._id,
  })
    .populate("user", "name email avatar")
    .populate("project", "name")
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({
    success: true,
    count: activities.length,
    activities,
  });
});