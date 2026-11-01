
import { Router } from "express";
import {
  login,
  register,
  me,
  updateProfile,
  changePassword,
  updateNotifications,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/me", protect, me);
router.patch("/profile", protect, updateProfile);
router.patch("/password", protect, changePassword);
router.patch("/notifications", protect, updateNotifications);

export default router;
