import { Router } from "express";

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
} from "../controllers/notificationController.js";

import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);

router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);

router.delete("/clear-all", clearNotifications);
router.delete("/:id", deleteNotification);

export default router;