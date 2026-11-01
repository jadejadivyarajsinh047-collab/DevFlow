
import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
} from "lucide-react";
import api from "../services/api";
import "../styles/secondary.css";

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError("");

      // Get all workspaces
      const workspaceResponse = await api.get("/workspaces");
      const workspaces = workspaceResponse.data.workspaces || [];

      if (!workspaces.length) {
        setTasks([]);
        return;
      }

      // Get tasks from all workspaces
      const responses = await Promise.all(
        workspaces.map((workspace) =>
          api.get(`/tasks?workspaceId=${workspace._id}`)
        )
      );

      const allTasks = responses.flatMap(
        (response) => response.data.tasks || []
      );

      // Get logged-in user
      const userResponse = await api.get("/auth/me");
      const user = userResponse.data.user;
      const userId = user.id;

      // Show tasks created by or assigned to this user
      const myTasks = allTasks.filter((task) => {
        const creatorId =
          task.createdBy?._id || task.createdBy;

        const assigneeId =
          task.assignee?._id || task.assignee;

        return (
          String(creatorId) === String(userId) ||
          String(assigneeId) === String(userId)
        );
      });

      setTasks(myTasks);
    } catch (err) {
      console.error("My Tasks error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load your tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const updateStatus = async (task) => {
    const nextStatus =
      task.status === "Done" ? "To do" : "Done";

    try {
      await api.patch(`/tasks/${task._id}`, {
        status: nextStatus,
      });

      await loadTasks();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update task."
      );
    }
  };

  return (
    <div className="secondary-page">
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">YOUR WORKSPACE</div>
          <h1>My Tasks</h1>
          <p>Tasks created by you or assigned to you.</p>
        </div>
      </div>

      <div className="toolbar">
        <span>
          <ListTodo size={17} /> {tasks.length} tasks
        </span>

        <button
          className="secondary-btn"
          onClick={loadTasks}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="inline-error">{error}</div>
      )}

      {loading ? (
        <p>Loading your tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="empty-workspace">
          <div className="empty-icon">
            <ListTodo size={24} />
          </div>
          <h2>No tasks found</h2>
          <p>
            Create a task in your project or assign a task
            to yourself.
          </p>
        </div>
      ) : (
        <div className="projects-grid">
          {tasks.map((task) => (
            <article
              className="project-card"
              key={task._id}
            >
              <div className="project-card-top">
                <div className="project-symbol large">
                  {task.status === "Done" ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Circle size={20} />
                  )}
                </div>

                <button
                  className="secondary-btn"
                  onClick={() => updateStatus(task)}
                >
                  {task.status === "Done"
                    ? "Reopen"
                    : "Complete"}
                </button>
              </div>

              <h3>{task.title}</h3>

              <p>
                {task.description ||
                  "No description provided."}
              </p>

              <div className="project-card-meta">
                <span
                  className={`status-chip ${
                    task.status === "Done"
                      ? "done"
                      : task.status === "In progress"
                        ? "active"
                        : "planning"
                  }`}
                >
                  {task.status}
                </span>

                <span>{task.priority} priority</span>
              </div>

              <div className="project-card-bottom">
                <span>
                  <Clock size={14} />{" "}
                  {task.dueDate
                    ? new Date(
                        task.dueDate
                      ).toLocaleDateString()
                    : "No deadline"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
