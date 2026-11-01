import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  FolderKanban,
  RefreshCw,
} from "lucide-react";

import api from "../services/api";
import "../styles/calendar.css";

const STATUSES = ["Backlog", "To do", "In progress", "In review", "Done"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const pad = (value) => String(value).padStart(2, "0");

const dateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateKey = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getTaskDate = (dueDate) => {
  if (!dueDate) return "";
  return new Date(dueDate).toISOString().slice(0, 10);
};

const formatDate = (date) =>
  date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const getInitialForm = (date) => ({
  title: "",
  description: "",
  projectId: "",
  dueDate: date,
  status: "To do",
  priority: "Medium",
});

function TaskModal({
  task,
  selectedDate,
  projects,
  onClose,
  onSave,
  saving,
}) {
  const [form, setForm] = useState(() => ({
    title: task?.title || "",
    description: task?.description || "",
    projectId:
      task?.project?._id ||
      task?.project ||
      projects[0]?._id ||
      "",
    dueDate: task?.dueDate ? getTaskDate(task.dueDate) : selectedDate,
    status: task?.status || "To do",
    priority: task?.priority || "Medium",
  }));

  useEffect(() => {
    setForm({
      title: task?.title || "",
      description: task?.description || "",
      projectId:
        task?.project?._id ||
        task?.project ||
        projects[0]?._id ||
        "",
      dueDate: task?.dueDate ? getTaskDate(task.dueDate) : selectedDate,
      status: task?.status || "To do",
      priority: task?.priority || "Medium",
    });
  }, [task, selectedDate, projects]);

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.projectId || !form.dueDate) {
      return;
    }

    onSave({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      dueDate: form.dueDate,
    });
  };

  return (
    <div
      className="calendar-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="calendar-modal">
        <div className="calendar-modal-header">
          <div>
            <span className="calendar-eyebrow">
              {task ? "UPDATE TASK" : "NEW TASK"}
            </span>
            <h2>{task ? "Edit task" : "Create a task"}</h2>
          </div>

          <button
            type="button"
            className="calendar-icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="calendar-modal-body">
            <label className="calendar-field">
              Task title
              <input
                autoFocus
                value={form.title}
                onChange={(event) =>
                  updateField("title", event.target.value)
                }
                placeholder="What needs to be done?"
                maxLength={160}
                required
              />
            </label>

            <label className="calendar-field">
              Description
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Add task details..."
                rows={3}
              />
            </label>

            <label className="calendar-field">
              Project
              <select
                value={form.projectId}
                onChange={(event) =>
                  updateField("projectId", event.target.value)
                }
                required
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="calendar-form-row">
              <label className="calendar-field">
                Due date
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    updateField("dueDate", event.target.value)
                  }
                  required
                />
              </label>

              <label className="calendar-field">
                Priority
                <select
                  value={form.priority}
                  onChange={(event) =>
                    updateField("priority", event.target.value)
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="calendar-field">
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  updateField("status", event.target.value)
                }
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="calendar-modal-footer">
            <button
              type="button"
              className="calendar-cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="calendar-primary-button"
              disabled={saving || !form.title.trim() || !form.projectId}
            >
              {saving ? "Saving..." : task ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Calendar() {
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState("month");

  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const workspaceResponse = await api.get("/workspaces");
      const workspaceList = workspaceResponse.data.workspaces || [];

      setWorkspaces(workspaceList);

      if (!workspaceList.length) {
        setWorkspaceId("");
        setProjects([]);
        setTasks([]);
        return;
      }

      const activeWorkspace =
        workspaceList.find((item) => item._id === workspaceId) ||
        workspaceList[0];

      const activeWorkspaceId = activeWorkspace._id;

      setWorkspaceId(activeWorkspaceId);

      const [projectResponse, taskResponse] = await Promise.all([
        api.get(`/projects/workspace/${activeWorkspaceId}`),
        api.get(`/tasks?workspaceId=${activeWorkspaceId}`),
      ]);

      setProjects(projectResponse.data.projects || []);
      setTasks(taskResponse.data.tasks || []);
    } catch (err) {
      console.error("Calendar loading error:", err);
      setError(
        err.response?.data?.message || "Unable to load calendar data.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const changeWorkspace = async (nextWorkspaceId) => {
    setWorkspaceId(nextWorkspaceId);
    setProjectFilter("all");
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;

      const taskProjectId =
        task.project?._id || task.project || "";

      if (projectFilter !== "all" && taskProjectId !== projectFilter) {
        return false;
      }

      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [tasks, projectFilter, statusFilter, priorityFilter]);

  const tasksByDate = useMemo(() => {
    const grouped = {};

    filteredTasks.forEach((task) => {
      const key = getTaskDate(task.dueDate);
      if (!key) return;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });

    return grouped;
  }, [filteredTasks]);

  const openCreateModal = (date = dateKey(currentDate)) => {
    setSelectedTask(null);
    setSelectedDate(date);
    setModalOpen(true);
  };

  const openEditModal = (task) => {
    setSelectedTask(task);
    setSelectedDate(getTaskDate(task.dueDate));
    setModalOpen(true);
  };

  const saveTask = async (formData) => {
    try {
      setSaving(true);
      setError("");

      if (selectedTask) {
        const response = await api.patch(
          `/tasks/${selectedTask._id}`,
          {
            title: formData.title,
            description: formData.description,
            dueDate: formData.dueDate,
            priority: formData.priority,
            status: formData.status,
          },
        );

        setTasks((previous) =>
          previous.map((task) =>
            task._id === selectedTask._id ? response.data.task : task,
          ),
        );
      } else {
        const response = await api.post("/tasks", {
          title: formData.title,
          description: formData.description,
          projectId: formData.projectId,
          dueDate: formData.dueDate,
          priority: formData.priority,
          status: formData.status,
        });

        setTasks((previous) => [...previous, response.data.task]);
      }

      setModalOpen(false);
      setSelectedTask(null);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save this task.",
      );
    } finally {
      setSaving(false);
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const navigateDate = (direction) => {
    setCurrentDate((previous) => {
      const next = new Date(previous);

      if (view === "month") {
        next.setMonth(next.getMonth() + direction);
      } else if (view === "week") {
        next.setDate(next.getDate() + direction * 7);
      } else {
        next.setDate(next.getDate() + direction);
      }

      return next;
    });
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const start = new Date(year, month, 1 - firstDay.getDay());

    const lastDay = new Date(year, month + 1, 0);
    const totalDays = Math.ceil(
      (firstDay.getDay() + lastDay.getDate()) / 7,
    ) * 7;

    return Array.from({ length: totalDays }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  };

  const getWeekDays = () => {
    const day = new Date(currentDate);
    day.setDate(day.getDate() - day.getDay());

    return Array.from({ length: 7 }, (_, index) => {
      const next = new Date(day);
      next.setDate(day.getDate() + index);
      return next;
    });
  };

  const headingText = () => {
    if (view === "month") {
      return currentDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }

    if (view === "day") return formatDate(currentDate);

    const days = getWeekDays();
    return `${days[0].toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })} – ${days[6].toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  };

  const renderTask = (task, compact = false) => (
    <button
      type="button"
      key={task._id}
      className={`calendar-task priority-border-${(
        task.priority || "medium"
      ).toLowerCase()} ${compact ? "calendar-task-compact" : ""}`}
      onClick={() => openEditModal(task)}
      title={`${task.title} · ${task.status} · ${task.priority}`}
    >
      <span className="calendar-task-title">{task.title}</span>
      {!compact && (
        <span className="calendar-task-meta">
          {task.status} · {task.priority}
        </span>
      )}
    </button>
  );

  const renderDayCell = (day, outsideMonth = false) => {
    const key = dateKey(day);
    const dayTasks = tasksByDate[key] || [];
    const today = key === dateKey(new Date());

    return (
      <div
        className={`calendar-day-cell ${
          outsideMonth ? "calendar-day-outside" : ""
        } ${today ? "calendar-day-today" : ""}`}
        key={key}
      >
        <div className="calendar-day-top">
          <button
            type="button"
            className="calendar-day-number"
            onClick={() => openCreateModal(key)}
            title={`Create task on ${formatDate(day)}`}
          >
            {day.getDate()}
          </button>

          <button
            type="button"
            className="calendar-day-add"
            onClick={() => openCreateModal(key)}
            aria-label={`Add task on ${formatDate(day)}`}
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="calendar-day-tasks">
          {dayTasks.slice(0, 3).map((task) => renderTask(task, true))}

          {dayTasks.length > 3 && (
            <span className="calendar-more-tasks">
              +{dayTasks.length - 3} more
            </span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="calendar-loading">
        <RefreshCw size={20} className="calendar-spin" />
        Loading calendar...
      </div>
    );
  }

  return (
    <main className="calendar-page">
      <header className="calendar-page-header">
        <div>
          <div className="calendar-title-line">
            <div className="calendar-heading-icon">
              <CalendarDays size={23} />
            </div>
            <div>
              <h1>Calendar</h1>
              <p>Plan deadlines and keep your work on track.</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="calendar-primary-button"
          onClick={() => openCreateModal()}
          disabled={!projects.length}
        >
          <Plus size={17} />
          Create task
        </button>
      </header>

      {error && <div className="calendar-error">{error}</div>}

      {!workspaces.length ? (
        <div className="calendar-empty-state">
          <FolderKanban size={34} />
          <h2>No workspace found</h2>
          <p>Create a workspace before using the calendar.</p>
        </div>
      ) : (
        <>
          <section className="calendar-toolbar">
            <div className="calendar-navigation">
              <button
                type="button"
                className="calendar-icon-button"
                onClick={() => navigateDate(-1)}
                aria-label="Previous"
              >
                <ChevronLeft size={19} />
              </button>

              <button
                type="button"
                className="calendar-icon-button"
                onClick={() => navigateDate(1)}
                aria-label="Next"
              >
                <ChevronRight size={19} />
              </button>

              <button
                type="button"
                className="calendar-today-button"
                onClick={goToToday}
              >
                Today
              </button>

              <h2>{headingText()}</h2>
            </div>

            <div className="calendar-view-switch">
              {["month", "week", "day"].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={view === item ? "active" : ""}
                  onClick={() => setView(item)}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <section className="calendar-filters">
            <label>
              Workspace
              <select
                value={workspaceId}
                onChange={(event) => changeWorkspace(event.target.value)}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace._id} value={workspace._id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Project
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="all">All priorities</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="calendar-summary">
            <div>
              <span className="calendar-summary-dot" />
              <strong>{filteredTasks.length}</strong>
              <span>tasks with due dates</span>
            </div>
            <span>{projects.length} projects</span>
          </section>

          {view === "month" && (
            <section className="calendar-grid calendar-month-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day) => (
                  <div className="calendar-weekday" key={day}>
                    {day}
                  </div>
                ),
              )}

              {getCalendarDays().map((day) =>
                renderDayCell(day, day.getMonth() !== currentDate.getMonth()),
              )}
            </section>
          )}

          {view === "week" && (
            <section className="calendar-grid calendar-week-grid">
              {getWeekDays().map((day) => (
                <div className="calendar-week-column" key={dateKey(day)}>
                  <div
                    className={`calendar-week-heading ${
                      dateKey(day) === dateKey(new Date())
                        ? "calendar-week-heading-today"
                        : ""
                    }`}
                  >
                    <span>
                      {day.toLocaleDateString(undefined, {
                        weekday: "short",
                      })}
                    </span>
                    <strong>{day.getDate()}</strong>
                  </div>

                  <div className="calendar-week-tasks">
                    {(tasksByDate[dateKey(day)] || []).map((task) =>
                      renderTask(task),
                    )}

                    <button
                      type="button"
                      className="calendar-add-day"
                      onClick={() => openCreateModal(dateKey(day))}
                    >
                      <Plus size={14} />
                      Add task
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {view === "day" && (
            <section className="calendar-single-day">
              <div className="calendar-single-day-heading">
                <div>
                  <span>
                    {currentDate.toLocaleDateString(undefined, {
                      weekday: "long",
                    })}
                  </span>
                  <h2>{currentDate.getDate()}</h2>
                  <p>{formatDate(currentDate)}</p>
                </div>

                <button
                  type="button"
                  className="calendar-primary-button"
                  onClick={() => openCreateModal(dateKey(currentDate))}
                >
                  <Plus size={16} />
                  Add task
                </button>
              </div>

              <div className="calendar-single-day-list">
                {(tasksByDate[dateKey(currentDate)] || []).length ? (
                  (tasksByDate[dateKey(currentDate)] || []).map((task) =>
                    renderTask(task),
                  )
                ) : (
                  <div className="calendar-no-tasks">
                    <Clock size={26} />
                    <p>No tasks scheduled for this day.</p>
                    <button
                      type="button"
                      onClick={() => openCreateModal(dateKey(currentDate))}
                    >
                      Create a task
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {modalOpen && (
        <TaskModal
          task={selectedTask}
          selectedDate={selectedDate}
          projects={projects}
          onClose={() => {
            setModalOpen(false);
            setSelectedTask(null);
          }}
          onSave={saveTask}
          saving={saving}
        />
      )}
    </main>
  );
}