
import { Router } from "express";

import {
  createWorkspace,
  listWorkspaces,
  getWorkspaceDetails,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
} from "../controllers/workspaceController.js";

import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/", listWorkspaces);
router.post("/", createWorkspace);

// Workspace settings
router.get("/:id", getWorkspaceDetails);
router.patch("/:id", updateWorkspace);
router.delete("/:id", deleteWorkspace);

// Workspace members
router.get("/:id/members", listWorkspaceMembers);
router.post("/:id/members", addWorkspaceMember);
router.delete("/:id/members/:userId", removeWorkspaceMember);

export default router;
