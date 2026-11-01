
import { Router } from "express";

import {
  listComments,
  createComment,
  deleteComment,
} from "../controllers/commentController.js";

import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/:taskId/comments", listComments);

router.post("/:taskId/comments", createComment);

router.delete(
  "/:taskId/comments/:commentId",
  deleteComment
);

export default router;
