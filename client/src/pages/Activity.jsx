
import React, { useCallback, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  CheckCircle2,
  CirclePlus,
  RefreshCw,
  Trash2,
  UserPlus,
  Pencil,
  Clock,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "../styles/activity.css";

const activityIcons = {
  task_created: CirclePlus,
  task_updated: Pencil,
  task_status_changed: CheckCircle2,
  task_assigned: UserPlus,
  task_unassigned: UserPlus,
  task_deleted: Trash2,
};

const formatDate = (date) => {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return "";

  return value.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function Activity() {
  const { user } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivities = useCallback(async (id) => {
    if (!id) return;

    try {
      setError("");

      const response = await api.get(`/activities/${id}`);

      setActivities(response.data.activities || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load activities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);

        const response = await api.get("/workspaces");

        const list = response.data.workspaces || [];

        setWorkspaces(list);

        if (list.length > 0) {
          const firstId = list[0]._id;
          setWorkspaceId(firstId);
          await loadActivities(firstId);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(
          err.response?.data?.message || "Unable to load workspaces.",
        );
        setLoading(false);
      }
    };

    initialize();
  }, [loadActivities]);

  useEffect(() => {
    if (!workspaceId) return;

    loadActivities(workspaceId);
  }, [workspaceId, loadActivities]);

  const filteredActivities =
    filter === "all"
      ? activities
      : activities.filter((item) => item.action === filter);

  const currentUserId = String(user?._id || user?.id || "");

  return (
    <div className="activity-page">
      <div className="activity-header">
        <div>
          <span className="activity-eyebrow">
            WORKSPACE TIMELINE
          </span>

          <h1>Activity</h1>

          <p>
            A live history of what's happening across your workspace.
          </p>
        </div>

        <button
          className="activity-refresh"
          onClick={() => loadActivities(workspaceId)}
          disabled={loading || !workspaceId}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {workspaces.length > 1 && (
        <div className="activity-workspace-select">
          <label htmlFor="activity-workspace">Workspace</label>

          <select
            id="activity-workspace"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace._id} value={workspace._id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="activity-stats">
        <div className="activity-stat">
          <span>Total activities</span>
          <strong>{activities.length}</strong>
        </div>

        <div className="activity-stat">
          <span>My activities</span>
          <strong>
            {
              activities.filter(
                (item) =>
                  String(item.user?._id) === currentUserId,
              ).length
            }
          </strong>
        </div>

        <div className="activity-stat">
          <span>Latest update</span>
          <strong>
            {activities.length
              ? formatDate(activities[0].createdAt)
              : "No activity"}
          </strong>
        </div>
      </div>

      <div className="activity-toolbar">
        <h2>Recent activity</h2>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter activities"
        >
          <option value="all">All activities</option>
          <option value="task_created">Created tasks</option>
          <option value="task_updated">Updated tasks</option>
          <option value="task_status_changed">Status changes</option>
          <option value="task_assigned">Assignments</option>
          <option value="task_unassigned">Unassignments</option>
          <option value="task_deleted">Deleted tasks</option>
        </select>
      </div>

      {error && <div className="activity-error">{error}</div>}

      {loading ? (
        <div className="activity-empty">
          <RefreshCw className="activity-spinner" size={28} />
          <p>Loading activities...</p>
        </div>
      ) : !workspaceId ? (
        <div className="activity-empty">
          <ActivityIcon size={35} />
          <h3>No workspace found</h3>
          <p>Create a workspace to start tracking activities.</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="activity-empty">
          <Clock size={35} />
          <h3>No activities yet</h3>
          <p>
            Create, update, assign, or delete a task to see its activity
            here.
          </p>
        </div>
      ) : (
        <div className="activity-list">
          {filteredActivities.map((item) => {
            const Icon = activityIcons[item.action] || ActivityIcon;

            return (
              <div className="activity-item" key={item._id}>
                <div className="activity-icon">
                  <Icon size={18} />
                </div>

                <div className="activity-content">
                  <div className="activity-message">
                    <strong>
                      {item.user?.name || item.user?.email || "A member"}
                    </strong>{" "}
                    {item.message}
                  </div>

                  <div className="activity-meta">
                    {item.project?.name && (
                      <span>{item.project.name}</span>
                    )}

                    <span>
                      <Clock size={13} />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
