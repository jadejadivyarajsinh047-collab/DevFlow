import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  FolderKanban,
  Plus,
  Sparkles,
  Target,
  Zap,
  ListTodo,
  Users,
  AlertTriangle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
} from "recharts";

import api from "../services/api";
import Modal from "../components/Modal";
import "../styles/dashboard.css";

const COLORS = {
  violet: "#8b7cf6",
  blue: "#38bdf8",
  green: "#34d399",
  orange: "#f59e0b",
  red: "#ef4444",
  gray: "#94a3b8",
};

const normalizeStatus = (status = "") =>
  String(status).toLowerCase().trim().replace(/[_-]/g, " ").replace(/\s+/g, " ");

const isDone = (task) =>
  ["done", "completed"].includes(normalizeStatus(task.status));

const isInProgress = (task) =>
  ["in progress", "inprogress", "in review"].includes(
    normalizeStatus(task.status),
  );

const isOverdue = (task) =>
  task.dueDate &&
  new Date(task.dueDate) < new Date() &&
  !isDone(task);

const getDateRange = (period) => {
  const now = new Date();
  const start = new Date(now);

  if (period === "week") {
    start.setDate(now.getDate() - 6);
  } else if (period === "month") {
    start.setDate(now.getDate() - 29);
  } else {
    start.setDate(now.getDate() - 364);
  }

  start.setHours(0, 0, 0, 0);
  return { start, end: now };
};

const getMemberName = (assignee) => {
  if (!assignee) return "Unassigned";
  if (typeof assignee === "string") return "Team member";
  return assignee.name || assignee.email || "Team member";
};

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState([]);
  const [workspace, setWorkspace] = useState("");
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [period, setPeriod] = useState("week");
  const [modal, setModal] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    description: "",
    priority: "Medium",
    title: "",
    projectId: "",
  });

  const load = async (requestedWorkspaceId = "") => {
    try {
      setError("");

      const response = await api.get("/workspaces");
      const workspaceList = Array.isArray(response.data.workspaces)
        ? response.data.workspaces
        : [];

      setWorkspaces(workspaceList);

      const current =
        requestedWorkspaceId || workspace || workspaceList[0]?._id || "";

      setWorkspace(current);

      if (!current) {
        setProjects([]);
        setTasks([]);
        return;
      }

      const [projectResponse, taskResponse] = await Promise.all([
        api.get(`/projects/workspace/${current}`),
        api.get(`/tasks?workspaceId=${current}`),
      ]);

      setProjects(
        Array.isArray(projectResponse.data.projects)
          ? projectResponse.data.projects
          : [],
      );

      setTasks(
        Array.isArray(taskResponse.data.tasks) ? taskResponse.data.tasks : [],
      );
    } catch (e) {
      console.error("Dashboard loading error:", e);
      setError(
        e.response?.data?.message || "Unable to load workspace data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Initial dashboard load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTasks = useMemo(() => {
    const { start, end } = getDateRange(period);

    return tasks.filter((task) => {
      if (!task.createdAt) return false;
      const createdAt = new Date(task.createdAt);
      return createdAt >= start && createdAt <= end;
    });
  }, [tasks, period]);

  const completedTasks = tasks.filter(isDone).length;
  const inProgressTasks = tasks.filter(isInProgress).length;
  const overdueTasks = tasks.filter(isOverdue).length;
  const pendingTasks = tasks.length - completedTasks;

  const completionPercentage = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  const stats = [
    {
      label: "Total tasks",
      value: tasks.length,
      icon: ListTodo,
      tone: "violet",
      change: "All workspace tasks",
    },
    {
      label: "In progress",
      value: inProgressTasks,
      icon: Zap,
      tone: "blue",
      change: "Currently active",
    },
    {
      label: "Completed",
      value: completedTasks,
      icon: Check,
      tone: "green",
      change: "Successfully finished",
    },
    {
      label: "Overdue",
      value: overdueTasks,
      icon: AlertTriangle,
      tone: "orange",
      change: "Need attention",
    },
  ];

  // Task status chart.
  const statusData = [
    {
      name: "To do",
      value: tasks.filter(
        (task) =>
          ["to do", "backlog"].includes(normalizeStatus(task.status)),
      ).length,
      color: COLORS.gray,
    },
    {
      name: "In progress",
      value: tasks.filter(isInProgress).length,
      color: COLORS.blue,
    },
    {
      name: "Done",
      value: completedTasks,
      color: COLORS.green,
    },
  ].filter((item) => item.value > 0);

  // Priority chart.
  const priorityData = ["Urgent", "High", "Medium", "Low"].map((priority) => ({
    priority,
    count: tasks.filter(
      (task) => normalizeStatus(task.priority) === priority.toLowerCase(),
    ).length,
  }));

  // Project completion.
  const projectProgress = projects.map((project) => {
    const projectTasks = tasks.filter(
      (task) =>
        String(task.project?._id || task.project) === String(project._id),
    );

    const done = projectTasks.filter(isDone).length;

    return {
      ...project,
      total: projectTasks.length,
      done,
      percentage: projectTasks.length
        ? Math.round((done / projectTasks.length) * 100)
        : 0,
    };
  });

  // Team performance based on assigned tasks.
  const teamPerformance = useMemo(() => {
    const members = {};

    tasks.forEach((task) => {
      const id =
        task.assignee?._id ||
        (typeof task.assignee === "string" ? task.assignee : "unassigned");

      if (!members[id]) {
        members[id] = {
          name: getMemberName(task.assignee),
          completed: 0,
          total: 0,
        };
      }

      members[id].total += 1;
      if (isDone(task)) members[id].completed += 1;
    });

    return Object.values(members)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 6);
  }, [tasks]);

  // Productivity chart based on real task creation dates.
  const productivityData = useMemo(() => {
    const days = period === "week" ? 7 : period === "month" ? 30 : 12;
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();

      if (period === "year") {
        date.setMonth(date.getMonth() - i);
      } else {
        date.setDate(date.getDate() - i);
      }

      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(date);

      if (period === "year") {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1, 0);
      }

      end.setHours(23, 59, 59, 999);

      const matching = tasks.filter((task) => {
        if (!task.createdAt) return false;
        const created = new Date(task.createdAt);
        return created >= start && created <= end;
      });

      result.push({
        day:
          period === "year"
            ? date.toLocaleDateString("en", { month: "short" })
            : date.toLocaleDateString("en", { weekday: "short" }),
        created: matching.length,
        completed: matching.filter(isDone).length,
      });
    }

    return result;
  }, [tasks, period]);

  const createWorkspace = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await api.post("/workspaces", {
        name: form.name,
        description: form.description,
      });

      const newId = response.data.workspace?._id;

      setForm((prev) => ({ ...prev, name: "", description: "" }));
      setModal("");
      await load(newId || "");
    } catch (e) {
      setError(e.response?.data?.message || "Could not create workspace.");
    } finally {
      setBusy(false);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();

    if (!workspace) {
      setError("Please select a workspace first.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api.post("/projects", {
        name: form.name,
        description: form.description,
        workspaceId: workspace,
        priority: form.priority,
      });

      setForm((prev) => ({ ...prev, name: "", description: "" }));
      setModal("");
      await load(workspace);
    } catch (e) {
      setError(e.response?.data?.message || "Could not create project.");
    } finally {
      setBusy(false);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();

    if (!form.projectId) {
      setError("Please select a project.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api.post("/tasks", {
        title: form.title,
        projectId: form.projectId,
      });

      setForm((prev) => ({ ...prev, title: "", projectId: "" }));
      setModal("");
      await load(workspace);
    } catch (e) {
      setError(e.response?.data?.message || "Could not create task.");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (task) => {
    try {
      setError("");

      await api.patch(`/tasks/${task._id}`, {
        status: isDone(task) ? "To do" : "Done",
      });

      await load(workspace);
    } catch (e) {
      setError(e.response?.data?.message || "Could not update task status.");
    }
  };

  const openTask = (projectId = "") => {
    setError("");
    setForm((prev) => ({ ...prev, title: "", projectId }));
    setModal("task");
  };

  const open = (kind) => {
    setError("");
    setModal(kind);
  };

  const changeWorkspace = (workspaceId) => {
    setWorkspace(workspaceId);
    load(workspaceId);
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="mini-empty">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="welcome-row">
        <div>
          <div className="page-eyebrow">
            <Sparkles size={14} /> WORKSPACE ANALYTICS
          </div>
          <h1>
            Good to see you <span>👋</span>
          </h1>
          <p>Track your projects, tasks and team productivity.</p>
        </div>

        <div className="welcome-actions">
          <button className="secondary-btn" onClick={() => open("workspace")}>
            <Plus size={16} /> Workspace
          </button>
          <button className="primary-btn" onClick={() => open("project")}>
            <Plus size={16} /> New project
          </button>
        </div>
      </div>

      {error && <div className="inline-error">{error}</div>}

      {!workspace && (
        <div className="empty-workspace">
          <div className="empty-icon">
            <FolderKanban size={24} />
          </div>
          <h2>Your workspace starts here</h2>
          <p>Create a workspace to bring your projects and people together.</p>
          <button className="primary-btn" onClick={() => open("workspace")}>
            <Plus size={16} /> Create workspace
          </button>
        </div>
      )}

      {workspace && (
        <>
          <div className="dashboard-toolbar">
            {workspaces.length > 1 && (
              <div className="workspace-select-row">
                <span>Workspace</span>
                <select
                  value={workspace}
                  onChange={(e) => changeWorkspace(e.target.value)}
                >
                  {workspaces.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="period-filter">
              <span>Analytics period</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="year">Last 12 months</option>
              </select>
            </div>
          </div>

          {/* Statistics */}
          <div className="stats-grid">
            {stats.map((item) => (
              <article className="stat-card" key={item.label}>
                <div className="stat-top">
                  <span>{item.label}</span>
                  <div className={`stat-icon ${item.tone}`}>
                    <item.icon size={18} />
                  </div>
                </div>
                <div className="stat-value">
                  {String(item.value).padStart(2, "0")}
                </div>
                <div className="stat-foot">
                  <span>{item.change}</span>
                  <span className="stat-neutral">
                    <ArrowUpRight size={13} />
                  </span>
                </div>
              </article>
            ))}
          </div>

          {/* Productivity and completion */}
          <div className="dashboard-grid">
            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h2>Productivity overview</h2>
                  <p>Tasks created during the selected period</p>
                </div>
              </div>

              <div className="chart-legend">
                <span>
                  <i className="legend-dot violet-dot" /> Completed
                </span>
                <span>
                  <i className="legend-dot blue-dot" /> Created
                </span>
              </div>

              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={productivityData}>
                    <defs>
                      <linearGradient id="doneGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.violet} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.violet} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--border)"
                      vertical={false}
                      strokeDasharray="4 5"
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        color: "var(--text)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Completed"
                      stroke={COLORS.violet}
                      strokeWidth={2.5}
                      fill="url(#doneGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      name="Created"
                      stroke={COLORS.blue}
                      strokeWidth={2.5}
                      fill="url(#createdGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel focus-panel">
              <div className="panel-heading">
                <div>
                  <h2>Overall completion</h2>
                  <p>Workspace task progress</p>
                </div>
                <div className="focus-icon">
                  <Target size={18} />
                </div>
              </div>

              <div className="focus-ring-wrap">
                <div
                  className="focus-ring"
                  style={{
                    background: `conic-gradient(${COLORS.violet} ${
                      completionPercentage * 3.6
                    }deg, var(--panel-2) 0deg)`,
                  }}
                >
                  <div>
                    <b>{completionPercentage}%</b>
                    <span>completed</span>
                  </div>
                </div>
              </div>

              <div className="focus-meta">
                <span>Completed tasks</span>
                <b>
                  {completedTasks} of {tasks.length}
                </b>
              </div>
              <div className="focus-progress">
                <i style={{ width: `${completionPercentage}%` }} />
              </div>
              <div className="focus-note">
                <Sparkles size={15} />
                <span>
                  {pendingTasks} task{pendingTasks === 1 ? "" : "s"} remaining.
                  Keep your momentum going!
                </span>
              </div>
            </section>
          </div>

          {/* Status and priority charts */}
          <div className="analytics-grid">
            <section className="panel analytics-panel">
              <div className="panel-heading">
                <div>
                  <h2>Task status distribution</h2>
                  <p>Current status of all workspace tasks</p>
                </div>
              </div>

              {tasks.length === 0 ? (
                <div className="mini-empty">No task data available yet.</div>
              ) : (
                <>
                  <div className="donut-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={4}
                        >
                          {statusData.map((item) => (
                            <Cell key={item.name} fill={item.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <b>{tasks.length}</b>
                      <span>Total tasks</span>
                    </div>
                  </div>
                  <div className="chart-key-list">
                    {statusData.map((item) => (
                      <div className="chart-key" key={item.name}>
                        <span>
                          <i style={{ background: item.color }} />
                          {item.name}
                        </span>
                        <b>{item.value}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="panel analytics-panel">
              <div className="panel-heading">
                <div>
                  <h2>Priority analysis</h2>
                  <p>Tasks grouped by priority</p>
                </div>
              </div>

              <div className="priority-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData} layout="vertical">
                    <CartesianGrid
                      stroke="var(--border)"
                      horizontal={false}
                    />
                    <XAxis type="number" allowDecimals={false} hide />
                    <YAxis
                      type="category"
                      dataKey="priority"
                      width={65}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        color: "var(--text)",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Tasks"
                      radius={[0, 7, 7, 0]}
                    >
                      {priorityData.map((item) => (
                        <Cell
                          key={item.priority}
                          fill={
                            item.priority === "Urgent"
                              ? COLORS.red
                              : item.priority === "High"
                                ? COLORS.orange
                                : item.priority === "Medium"
                                  ? COLORS.blue
                                  : COLORS.green
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Project progress */}
          <section className="panel project-analytics-panel">
            <div className="panel-heading">
              <div>
                <h2>Project progress</h2>
                <p>Completion percentage for each project</p>
              </div>
              <button className="text-action" onClick={() => open("project")}>
                New project <ArrowRight size={14} />
              </button>
            </div>

            {projectProgress.length === 0 ? (
              <div className="mini-empty">Create a project to see progress.</div>
            ) : (
              <div className="project-progress-list">
                {projectProgress.map((project, index) => (
                  <div className="project-progress-item" key={project._id}>
                    <div className="project-progress-top">
                      <div className="project-progress-name">
                        <span
                          className="project-symbol"
                          style={{
                            background: `${project.color || COLORS.violet}22`,
                            color: project.color || COLORS.violet,
                          }}
                        >
                          <FolderKanban size={17} />
                        </span>
                        <div>
                          <b>{project.name}</b>
                          <span>
                            {project.done} of {project.total} tasks completed
                          </span>
                        </div>
                      </div>
                      <b className="project-percent">
                        {project.percentage}%
                      </b>
                    </div>
                    <div className="project-progress-track">
                      <i
                        style={{
                          width: `${project.percentage}%`,
                          background: project.color || COLORS.violet,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Team performance and recent tasks */}
          <div className="lower-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Team performance</h2>
                  <p>Completed tasks by assigned member</p>
                </div>
                <Users size={19} />
              </div>

              {teamPerformance.length === 0 ? (
                <div className="mini-empty">
                  No assigned tasks available yet.
                </div>
              ) : (
                <div className="team-performance-list">
                  {teamPerformance.map((member, index) => (
                    <div className="team-performance-row" key={member.name + index}>
                      <div className="member-avatar">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="member-performance-info">
                        <b>{member.name}</b>
                        <div className="member-progress-track">
                          <i
                            style={{
                              width: `${
                                member.total
                                  ? (member.completed / member.total) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <span>
                        {member.completed}/{member.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel tasks-panel">
              <div className="panel-heading">
                <div>
                  <h2>Recent tasks</h2>
                  <p>Recently updated workspace tasks</p>
                </div>
                <button
                  className="icon-btn subtle"
                  onClick={() => openTask()}
                  title="Add task"
                >
                  <Plus size={17} />
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="mini-empty">
                  Your task list is clear. Add a task to get moving.
                </div>
              ) : (
                <div className="task-list">
                  {tasks.slice(0, 5).map((task) => (
                    <div className="task-row" key={task._id}>
                      <button
                        className={`task-check ${isDone(task) ? "checked" : ""}`}
                        onClick={() => updateStatus(task)}
                        title="Change task status"
                      >
                        {isDone(task) && <Check size={12} />}
                      </button>
                      <div className="task-info">
                        <b className={isDone(task) ? "completed-text" : ""}>
                          {task.title}
                        </b>
                        <span>
                          {task.project?.name || "Project task"}
                        </span>
                      </div>
                      <span
                        className={`priority-dot ${
                          task.priority?.toLowerCase() || "medium"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* Workspace modal */}
      <Modal
        open={modal === "workspace"}
        title="Create a workspace"
        subtitle="A shared home for your team's projects."
        onClose={() => setModal("")}
      >
        <form className="modal-form" onSubmit={createWorkspace}>
          <label>
            Workspace name
            <input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              placeholder="e.g. Acme Studio"
              required
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="What is this workspace for?"
            />
          </label>
          <button className="primary-btn" disabled={busy}>
            {busy ? "Creating..." : "Create workspace"}
            <ArrowRight size={16} />
          </button>
        </form>
      </Modal>

      {/* Project modal */}
      <Modal
        open={modal === "project"}
        title="Create a project"
        subtitle="Give your next big idea a place to grow."
        onClose={() => setModal("")}
      >
        <form className="modal-form" onSubmit={createProject}>
          <label>
            Project name
            <input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              placeholder="e.g. Website redesign"
              required
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="A short project summary"
            />
          </label>
          <label>
            Priority
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value })
              }
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </label>
          <button className="primary-btn" disabled={busy}>
            {busy ? "Creating..." : "Create project"}
            <ArrowRight size={16} />
          </button>
        </form>
      </Modal>

      {/* Task modal */}
      <Modal
        open={modal === "task"}
        title="Create a task"
        subtitle="Break your project into an actionable next step."
        onClose={() => setModal("")}
      >
        <form className="modal-form" onSubmit={createTask}>
          <label>
            Task title
            <input
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              placeholder="e.g. Design onboarding screen"
              required
            />
          </label>
          <label>
            Project
            <select
              value={form.projectId}
              onChange={(e) =>
                setForm({ ...form, projectId: e.target.value })
              }
              required
            >
              <option value="">Choose a project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-btn"
            disabled={busy || !projects.length}
          >
            {busy ? "Creating..." : "Create task"}
            <ArrowRight size={16} />
          </button>
        </form>
      </Modal>
    </div>
  );
}