import express from "express";
import { protect } from "../middleware/auth.js";

import {
  getMessages,
  sendMessage,
  deleteMessage,
} from "../controllers/chatController.js";

const router = express.Router();

router.use(protect);

router.get(
  "/workspaces/:workspaceId/messages",
  getMessages,
);

router.post(
  "/workspaces/:workspaceId/messages",
  sendMessage,
);

router.delete(
  "/messages/:messageId",
  deleteMessage,
);

export default router;