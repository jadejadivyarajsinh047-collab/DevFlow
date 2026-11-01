import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: {
          type: String,
          enum: ["Owner", "Admin", "Manager", "Member", "Viewer"],
          default: "Member",
        },
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model("Workspace", workspaceSchema);
