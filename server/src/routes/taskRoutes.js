import { Router } from "express";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from "../controllers/taskController.js";
import { protect } from "../middleware/auth.js";
const router = Router();
router.use(protect);
router.get("/", listTasks);
router.post("/", createTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);
export default router;
