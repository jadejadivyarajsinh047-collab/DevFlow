
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

import { useNavigate, useParams } from "react-router-dom";

import { io } from "socket.io-client";

import {
  ArrowLeft,
  CirclePlus,
  FolderKanban,
  RefreshCw,
  GripVertical,
  X,
  Trash2,
  Pencil,
  CalendarDays,
  Save,
  MessageCircle,
  Send,
} from "lucide-react";

import api from "../services/api";
import "../styles/board.css";

const columns = [
  { name: "To do", color: "#8b8b9a" },
  { name: "In progress", color: "#6488ed" },
  { name: "In review", color: "#d49b42" },
  { name: "Done", color: "#39a77b" },
];

const priorities = ["Low", "Medium", "High", "Urgent"];

/* =================================
   TASK DETAILS MODAL
================================= */

function TaskDetailsModal({
  task,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
  socket,
  members,
}) {
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(
    task.description || ""
  );
  const [priority, setPriority] = useState(
    task.priority || "Medium"
  );

  const [assignee, setAssignee] = useState(
    task.assignee?._id || task.assignee || ""
  );

  const [dueDate, setDueDate] = useState(
    task.dueDate
      ? new Date(task.dueDate).toISOString().slice(0, 10)
      : ""
  );

  // Comments states
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  // Load comments and logged-in user
  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      try {
        setCommentsLoading(true);
        setCommentsError("");

        const [commentsResponse, userResponse] =
          await Promise.all([
            api.get(`/tasks/${task._id}/comments`),
            api.get("/auth/me"),
          ]);

        if (cancelled) return;

        setComments(commentsResponse.data.comments || []);

        setCurrentUserId(
          userResponse.data.user?.id ||
          userResponse.data.user?._id ||
          ""
        );
      } catch (err) {
        if (!cancelled) {
          setCommentsError(
            err.response?.data?.message ||
            "Unable to load comments."
          );
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [task._id]);

  // Receive live comments
  useEffect(() => {
    if (!socket) return;

    const handleCommentCreated = ({ taskId, comment }) => {
      if (String(taskId) !== String(task._id)) return;

      setComments((previous) => {
        const alreadyExists = previous.some(
          (item) => item._id === comment._id
        );

        if (alreadyExists) return previous;

        return [...previous, comment];
      });
    };

    const handleCommentDeleted = ({ taskId, commentId }) => {
      if (String(taskId) !== String(task._id)) return;

      setComments((previous) =>
        previous.filter(
          (comment) => comment._id !== commentId
        )
      );
    };

    socket.on("comment:created", handleCommentCreated);
    socket.on("comment:deleted", handleCommentDeleted);

    return () => {
      socket.off("comment:created", handleCommentCreated);
      socket.off("comment:deleted", handleCommentDeleted);
    };
  }, [socket, task._id]);

  // Save task
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || null,
      assignee: assignee || null,
    });
  };

  // Add comment
  const handleAddComment = async (e) => {
    e.preventDefault();

    const content = commentText.trim();

    if (!content || commentSaving) return;

    try {
      setCommentSaving(true);
      setCommentsError("");

      const response = await api.post(
        `/tasks/${task._id}/comments`,
        { content }
      );

      setComments((previous) => {
        const alreadyExists = previous.some(
          (item) => item._id === response.data.comment._id
        );

        if (alreadyExists) return previous;

        return [...previous, response.data.comment];
      });

      setCommentText("");
    } catch (err) {
      setCommentsError(
        err.response?.data?.message ||
        "Unable to add comment."
      );
    } finally {
      setCommentSaving(false);
    }
  };

  // Delete own comment
  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this comment?"
    );

    if (!confirmed) return;

    try {
      setCommentsError("");

      await api.delete(
        `/tasks/${task._id}/comments/${commentId}`
      );

      setComments((previous) =>
        previous.filter(
          (comment) => comment._id !== commentId
        )
      );
    } catch (err) {
      setCommentsError(
        err.response?.data?.message ||
        "Unable to delete comment."
      );
    }
  };

  return (
    <div
      className="task-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        {/* Modal header */}

        <div className="task-modal-header">
          <div>
            <span className="task-modal-eyebrow">
              TASK DETAILS
            </span>

            <h2 id="task-modal-title">Edit task</h2>
          </div>

          <button
            type="button"
            className="task-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={19} />
          </button>
        </div>

        {/* Task edit form */}

        <form onSubmit={handleSubmit}>
          <div className="task-modal-body">
            <div className="task-form-group">
              <label htmlFor="task-title">
                Task title
              </label>

              <input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                placeholder="Enter task title"
                required
              />
            </div>

            <div className="task-form-group">
              <label htmlFor="task-description">
                Description
              </label>

              <textarea
                id="task-description"
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                rows={5}
                placeholder="Describe this task..."
              />
            </div>

            <div className="task-form-row">
              <div className="task-form-group">
                <label htmlFor="task-priority">
                  Priority
                </label>

                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value)
                  }
                >
                  {priorities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="task-form-group">
                <label htmlFor="task-due-date">
                  <CalendarDays size={14} />
                  Due date
                </label>

                <input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) =>
                    setDueDate(e.target.value)
                  }
                />
              </div>
            </div>

            {/* Assign task */}

            <div className="task-form-group">
              <label htmlFor="task-assignee">
                Assign task to
              </label>

              <select
                id="task-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>

                {members.map((member) => {
                  const person = member.user;

                  if (!person?._id) return null;

                  return (
                    <option
                      key={person._id}
                      value={person._id}
                    >
                      {person.name || person.email} ({member.role})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="task-modal-meta">
              <span>Task ID</span>
              <code>#{task._id.slice(-6)}</code>
            </div>
          </div>

          <div className="task-modal-footer">
            <button
              type="button"
              className="task-delete-button"
              onClick={() => onDelete(task._id)}
              disabled={deleting || saving}
            >
              <Trash2 size={15} />
              {deleting ? "Deleting..." : "Delete task"}
            </button>

            <div className="task-modal-actions">
              <button
                type="button"
                className="task-modal-cancel"
                onClick={onClose}
                disabled={saving || deleting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="task-modal-save"
                disabled={
                  saving || deleting || !title.trim()
                }
              >
                <Save size={15} />
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>

        {/* COMMENTS SECTION */}

        <section className="task-comments">
          <div className="task-comments-heading">
            <h3>
              <MessageCircle size={18} />
              Comments
            </h3>

            <span>{comments.length}</span>
          </div>

          {commentsError && (
            <div className="task-comments-error">
              {commentsError}
            </div>
          )}

          {commentsLoading ? (
            <p className="task-comments-message">
              Loading comments...
            </p>
          ) : comments.length === 0 ? (
            <p className="task-comments-message">
              No comments yet. Start the conversation!
            </p>
          ) : (
            <div className="task-comment-list">
              {comments.map((comment) => {
                const authorId =
                  comment.author?._id || "";

                const isOwnComment =
                  currentUserId &&
                  authorId.toString() ===
                    currentUserId.toString();

                return (
                  <article
                    className="task-comment"
                    key={comment._id}
                  >
                    <div className="task-comment-avatar">
                      {(
                        comment.author?.name ||
                        comment.author?.email ||
                        "M"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="task-comment-content">
                      <div className="task-comment-top">
                        <strong>
                          {comment.author?.name ||
                            comment.author?.email ||
                            "Member"}
                        </strong>

                        <time>
                          {new Date(
                            comment.createdAt
                          ).toLocaleString()}
                        </time>
                      </div>

                      <p>{comment.content}</p>
                    </div>

                    {isOwnComment && (
                      <button
                        type="button"
                        className="task-comment-delete"
                        title="Delete your comment"
                        onClick={() =>
                          handleDeleteComment(comment._id)
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Add comment form */}

          <form
            className="task-comment-form"
            onSubmit={handleAddComment}
          >
            <textarea
              value={commentText}
              onChange={(e) =>
                setCommentText(e.target.value)
              }
              placeholder="Write a comment..."
              maxLength={2000}
              rows={2}
              required
            />

            <div className="task-comment-form-footer">
              <span>{commentText.length}/2000</span>

              <button
                type="submit"
                disabled={
                  commentSaving || !commentText.trim()
                }
              >
                <Send size={14} />
                {commentSaving ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

/* =================================
   DRAGGABLE TASK CARD
================================= */

function TaskCard({ task, changeStatus, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task._id,
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.35 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : 1,
  };

  const assigneeName =
    task.assignee?.name ||
    task.assignee?.email ||
    "";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`kanban-task-card ${
        isDragging ? "kanban-task-dragging" : ""
      }`}
    >
      <div className="kanban-task-top">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="kanban-drag-handle"
          aria-label={`Drag ${task.title}`}
          title="Drag task"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>

        <span
          className={`kanban-priority priority-${(
            task.priority || "medium"
          ).toLowerCase()}`}
        >
          {task.priority || "Medium"}
        </span>

        <span className="kanban-task-date">
          {task.dueDate
            ? new Date(task.dueDate).toLocaleDateString()
            : ""}
        </span>
      </div>

      <button
        type="button"
        className="kanban-task-open"
        onClick={() => onOpen(task)}
      >
        {task.title}
      </button>

      {task.description && (
        <p>{task.description}</p>
      )}

      {/* Assigned member */}

      {task.assignee && (
        <div className="kanban-assignee">
          <div className="kanban-assignee-avatar">
            {(
              assigneeName || "U"
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          <span>
            {assigneeName || "Assigned member"}
          </span>
        </div>
      )}

      <div className="kanban-task-footer">
        <span className="kanban-task-id">
          #{task._id.slice(-6)}
        </span>

        <select
          aria-label={`Change status of ${task.title}`}
          value={
            task.status === "Backlog"
              ? "To do"
              : task.status
          }
          onChange={(e) =>
            changeStatus(task._id, e.target.value)
          }
        >
          {columns.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="kanban-edit-button"
          title="Edit task"
          onClick={() => onOpen(task)}
        >
          <Pencil size={14} />
        </button>
      </div>
    </article>
  );
}

/* =================================
   DROPPABLE KANBAN COLUMN
================================= */

function KanbanColumn({
  column,
  tasks,
  changeStatus,
  setAdding,
  onOpen,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.name,
  });

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column ${
        isOver ? "kanban-column-over" : ""
      }`}
    >
      <div className="kanban-column-heading">
        <div className="kanban-column-label">
          <span
            className="kanban-dot"
            style={{ background: column.color }}
          />

          <h2>{column.name}</h2>

          <span className="kanban-count">
            {tasks.length}
          </span>
        </div>

        <button
          type="button"
          className="kanban-column-add"
          title={`Add task to ${column.name}`}
          onClick={() => setAdding(true)}
        >
          <CirclePlus size={17} />
        </button>
      </div>

      <div className="kanban-task-list">
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            changeStatus={changeStatus}
            onOpen={onOpen}
          />
        ))}

        {tasks.length === 0 && (
          <div className="kanban-empty">
            Drop tasks here
          </div>
        )}
      </div>
    </section>
  );
}

/* =================================
   MAIN BOARD
================================= */

export default function Board() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [socket, setSocket] = useState(null);

  const [title, setTitle] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [error, setError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  // Load project, members and tasks
  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const projectResponse = await api.get(
        `/projects/${projectId}`
      );

      const currentProject = projectResponse.data.project;

      setProject(currentProject);

      const currentWorkspaceId =
        currentProject.workspace?._id ||
        currentProject.workspace;

      if (!currentWorkspaceId) {
        throw new Error("This project has no workspace.");
      }

      const [membersResponse, taskResponse] =
        await Promise.all([
          api.get(
            `/workspaces/${currentWorkspaceId}/members`
          ),
          api.get(
            `/tasks?workspaceId=${currentWorkspaceId}&projectId=${projectId}`
          ),
        ]);

      setMembers(membersResponse.data.members || []);
      setTasks(taskResponse.data.tasks || []);
    } catch (err) {
      console.error("Board loading error:", err);

      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to load this project board."
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Get workspace ID
  const workspaceId =
    project?.workspace?._id || project?.workspace;

  /* =================================
     SOCKET.IO CONNECTION
  ================================= */

  useEffect(() => {
    if (!workspaceId) return;

    const token = localStorage.getItem("devflow_token");

    if (!token) return;

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (api.defaults.baseURL || "http://localhost:5000/api")
        .replace(/\/api\/?$/, "");

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("DevFlow real-time connected.");
      newSocket.emit("workspace:join", workspaceId);
    });

    newSocket.on("workspace:joined", (data) => {
      console.log("Joined workspace:", data.workspaceId);
    });

    newSocket.on("workspace:error", (data) => {
      console.error("Workspace socket error:", data.message);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    // TASK CREATED
    newSocket.on("task:created", ({ task }) => {
      const taskProjectId =
        typeof task.project === "object"
          ? task.project?._id
          : task.project;

      if (String(taskProjectId) !== String(projectId)) {
        return;
      }

      setTasks((previous) => {
        const alreadyExists = previous.some(
          (item) => item._id === task._id
        );

        if (alreadyExists) return previous;

        return [...previous, task];
      });
    });

    // TASK UPDATED
    newSocket.on("task:updated", ({ task }) => {
      const taskProjectId =
        typeof task.project === "object"
          ? task.project?._id
          : task.project;

      if (String(taskProjectId) !== String(projectId)) {
        return;
      }

      setTasks((previous) =>
        previous.map((item) =>
          item._id === task._id ? task : item
        )
      );

      setSelectedTask((previous) =>
        previous?._id === task._id ? task : previous
      );
    });

    // TASK DELETED
    newSocket.on(
      "task:deleted",
      ({ taskId, projectId: deletedProjectId }) => {
        if (String(deletedProjectId) !== String(projectId)) {
          return;
        }

        setTasks((previous) =>
          previous.filter((task) => task._id !== taskId)
        );

        setSelectedTask((previous) =>
          previous?._id === taskId ? null : previous
        );
      }
    );

    return () => {
      newSocket.emit("workspace:leave", workspaceId);
      newSocket.disconnect();

      setSocket((previous) =>
        previous === newSocket ? null : previous
      );
    };
  }, [workspaceId, projectId]);

  /* =================================
     CREATE TASK
  ================================= */

  const addTask = async (e) => {
    e.preventDefault();

    if (!title.trim()) return;

    try {
      setSaving(true);
      setError("");

      await api.post("/tasks", {
        title: title.trim(),
        projectId,
        status: "To do",
        priority: "Medium",
        assignee: selectedAssignee || null,
      });

      setTitle("");
      setSelectedAssignee("");
      setAdding(false);

      await loadBoard();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to create task."
      );
    } finally {
      setSaving(false);
    }
  };

  /* =================================
     CHANGE TASK STATUS
  ================================= */

  const changeStatus = async (taskId, status) => {
    const previousTasks = tasks;

    try {
      setError("");

      setTasks((previous) =>
        previous.map((task) =>
          task._id === taskId
            ? { ...task, status }
            : task
        )
      );

      const response = await api.patch(
        `/tasks/${taskId}`,
        { status }
      );

      setTasks((previous) =>
        previous.map((task) =>
          task._id === taskId
            ? response.data.task
            : task
        )
      );
    } catch (err) {
      setTasks(previousTasks);

      setError(
        err.response?.data?.message ||
        "Unable to update task status."
      );
    }
  };

  /* =================================
     EDIT TASK
  ================================= */

  const saveTask = async (updatedData) => {
    if (!selectedTask) return;

    try {
      setSaving(true);
      setError("");

      const response = await api.patch(
        `/tasks/${selectedTask._id}`,
        updatedData
      );

      setTasks((previous) =>
        previous.map((task) =>
          task._id === selectedTask._id
            ? response.data.task
            : task
        )
      );

      setSelectedTask(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to save task changes."
      );
    } finally {
      setSaving(false);
    }
  };

  /* =================================
     DELETE TASK
  ================================= */

  const deleteTask = async (taskId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(`/tasks/${taskId}`);

      setTasks((previous) =>
        previous.filter((task) => task._id !== taskId)
      );

      setSelectedTask(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete task."
      );
    } finally {
      setDeleting(false);
    }
  };

  /* =================================
     DRAG AND DROP
  ================================= */

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over) return;

    const taskId = String(active.id);
    const newStatus = String(over.id);

    if (
      !columns.some((column) => column.name === newStatus)
    ) {
      return;
    }

    const currentTask = tasks.find(
      (task) => task._id === taskId
    );

    if (!currentTask) return;

    const currentStatus =
      currentTask.status === "Backlog"
        ? "To do"
        : currentTask.status;

    if (currentStatus === newStatus) return;

    changeStatus(taskId, newStatus);
  };

  // Get tasks by column
  const getColumnTasks = (status) =>
    tasks.filter((task) => {
      if (status === "To do") {
        return (
          task.status === "To do" ||
          task.status === "Backlog"
        );
      }

      return task.status === status;
    });

  /* =================================
     LOADING
  ================================= */

  if (loading) {
    return (
      <div className="board-loading">
        Loading project board...
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="secondary-page">
        <div className="inline-error">{error}</div>

        <button
          className="secondary-btn"
          onClick={() => navigate("/app/projects")}
        >
          Back to projects
        </button>

        <button
          className="secondary-btn"
          onClick={loadBoard}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!project) return null;

  /* =================================
     BOARD UI
  ================================= */

  return (
    <div className="board-page">
      <div className="board-heading">
        <div>
          <button
            className="board-back"
            onClick={() => navigate("/app/projects")}
          >
            <ArrowLeft size={16} />
            Back to projects
          </button>

          <div className="board-title-row">
            <div
              className="board-project-icon"
              style={{
                background: `${project.color || "#7667f5"}20`,
                color: project.color || "#7667f5",
              }}
            >
              <FolderKanban size={23} />
            </div>

            <div>
              <h1>{project.name}</h1>

              <p>
                {project.description ||
                  "Manage your project tasks and progress."}
              </p>
            </div>
          </div>
        </div>

        <div className="board-heading-actions">
          <button
            className="board-refresh"
            onClick={loadBoard}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            className="board-add-button"
            onClick={() => {
              setAdding((previous) => !previous);
              setTitle("");
              setSelectedAssignee("");
            }}
          >
            <CirclePlus size={17} />
            Add task
          </button>
        </div>
      </div>

      {error && (
        <div className="inline-error">{error}</div>
      )}

      {/* Add task form */}

      {adding && (
        <form className="board-add-form" onSubmit={addTask}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title..."
            maxLength={160}
            required
          />

          <select
            value={selectedAssignee}
            onChange={(e) =>
              setSelectedAssignee(e.target.value)
            }
            aria-label="Assign task to"
          >
            <option value="">Unassigned</option>

            {members.map((member) => {
              const person = member.user;

              if (!person?._id) return null;

              return (
                <option
                  key={person._id}
                  value={person._id}
                >
                  Assign to: {person.name || person.email}
                </option>
              );
            })}
          </select>

          <button
            className="board-add-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Create task"}
          </button>

          <button
            className="board-cancel-button"
            type="button"
            onClick={() => {
              setAdding(false);
              setTitle("");
              setSelectedAssignee("");
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Board summary */}

      <div className="board-summary">
        <span>{tasks.length} total tasks</span>

        <span>
          {tasks.filter((task) => task.status === "Done").length}
          {" "}completed
        </span>
      </div>

      {/* Kanban columns */}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {columns.map((column) => (
            <KanbanColumn
              key={column.name}
              column={column}
              tasks={getColumnTasks(column.name)}
              changeStatus={changeStatus}
              setAdding={setAdding}
              onOpen={setSelectedTask}
            />
          ))}
        </div>
      </DndContext>

      {/* Task details modal */}

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={saveTask}
          onDelete={deleteTask}
          saving={saving}
          deleting={deleting}
          socket={socket}
          members={members}
        />
      )}
    </div>
  );
}
