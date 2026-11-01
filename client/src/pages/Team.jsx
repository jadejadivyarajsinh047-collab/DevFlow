
import React, { useCallback, useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  Shield,
  Mail,
  Building2,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../styles/team.css";

export default function Team() {
  const { user } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [members, setMembers] = useState([]);
  const [owner, setOwner] = useState(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Member");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load members of selected workspace
  const loadMembers = useCallback(async (id) => {
    if (!id) {
      setMembers([]);
      setOwner(null);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/workspaces/${id}/members`
      );

      setMembers(response.data.members || []);
      setOwner(response.data.owner || null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load workspace members."
      );

      setMembers([]);
      setOwner(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load all workspaces and select first workspace
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/workspaces");

        const workspaceList = response.data.workspaces || [];

        setWorkspaces(workspaceList);

        if (workspaceList.length > 0) {
          const firstWorkspaceId = workspaceList[0]._id;

          setWorkspaceId(firstWorkspaceId);

          await loadMembers(firstWorkspaceId);
        } else {
          setWorkspaceId("");
          setMembers([]);
          setOwner(null);
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to load workspaces."
        );
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaces();
  }, [loadMembers]);

  // Switch workspace
  const handleWorkspaceChange = async (e) => {
    const id = e.target.value;

    setWorkspaceId(id);
    setSuccess("");
    setError("");

    await loadMembers(id);
  };

  // Add member
  const handleInvite = async (e) => {
    e.preventDefault();

    if (!workspaceId) {
      setError("Please select a workspace first.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter a member email address.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.post(
        `/workspaces/${workspaceId}/members`,
        {
          email: email.trim().toLowerCase(),
          role,
        }
      );

      setEmail("");
      setRole("Member");

      setSuccess("Team member added successfully.");

      await loadMembers(workspaceId);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to add team member."
      );
    } finally {
      setSaving(false);
    }
  };

  // Remove member
  const handleRemove = async (memberId, name) => {
    if (!workspaceId) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${name} from this workspace?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.delete(
        `/workspaces/${workspaceId}/members/${memberId}`
      );

      setSuccess("Member removed successfully.");

      await loadMembers(workspaceId);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to remove member."
      );
    }
  };

  const currentUserId = user?._id || user?.id;

  const adminCount = members.filter((member) =>
    ["Owner", "Admin"].includes(member.role)
  ).length;

  if (loading && workspaces.length === 0) {
    return (
      <div className="team-loading">
        Loading workspaces...
      </div>
    );
  }

  return (
    <div className="team-page">
      {/* Header */}
      <div className="team-header">
        <div>
          <span className="team-eyebrow">
            WORKSPACE MANAGEMENT
          </span>

          <h1>Team Members</h1>

          <p>
            Manage your workspace team and member access.
          </p>
        </div>

        <button
          className="team-refresh"
          onClick={() => loadMembers(workspaceId)}
          disabled={!workspaceId || loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Workspace selector */}
      {workspaces.length > 0 && (
        <div className="team-workspace-selector">
          <Building2 size={18} />

          <select
            value={workspaceId}
            onChange={handleWorkspaceChange}
          >
            {workspaces.map((workspace) => (
              <option
                key={workspace._id}
                value={workspace._id}
              >
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="team-alert team-alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="team-alert team-alert-success">
          {success}
        </div>
      )}

      {/* No workspace */}
      {workspaces.length === 0 && !loading ? (
        <section className="team-panel team-no-workspace">
          <Building2 size={35} />

          <h2>No workspace found</h2>

          <p>
            Create a workspace before managing team members.
          </p>
        </section>
      ) : (
        <>
          {/* Statistics */}
          <div className="team-stats">
            <div className="team-stat-card">
              <div className="team-stat-icon">
                <Users size={21} />
              </div>

              <div>
                <h2>{members.length}</h2>
                <p>Total members</p>
              </div>
            </div>

            <div className="team-stat-card">
              <div className="team-stat-icon">
                <Shield size={21} />
              </div>

              <div>
                <h2>{adminCount}</h2>
                <p>Administrators</p>
              </div>
            </div>
          </div>

          {/* Add member */}
          <section className="team-panel">
            <div className="team-panel-heading">
              <div>
                <h2>
                  <UserPlus size={19} />
                  Add team member
                </h2>

                <p>
                  Add an existing DevFlow user using their email.
                </p>
              </div>
            </div>

            <form
              className="team-invite-form"
              onSubmit={handleInvite}
            >
              <div className="team-input-group">
                <Mail size={17} />

                <input
                  type="email"
                  placeholder="Enter member email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Manager">Manager</option>
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
                <option value="Admin">Admin</option>
              </select>

              <button
                type="submit"
                disabled={saving || !workspaceId}
              >
                <UserPlus size={16} />

                {saving ? "Adding..." : "Add member"}
              </button>
            </form>
          </section>

          {/* Members list */}
          <section className="team-panel">
            <div className="team-panel-heading">
              <div>
                <h2>
                  <Users size={19} />
                  Workspace members
                </h2>

                <p>
                  People who have access to this workspace.
                </p>
              </div>

              <span className="team-member-count">
                {members.length} members
              </span>
            </div>

            {loading ? (
              <div className="team-empty">
                Loading members...
              </div>
            ) : (
              <div className="team-table">
                <div className="team-table-header">
                  <span>MEMBER</span>
                  <span>ROLE</span>
                  <span>ACTION</span>
                </div>

                {members.map((member) => {
                  const person = member.user;

                  if (!person) return null;

                  const isOwner =
                    member.role === "Owner" ||
                    String(person._id) === String(owner?._id);

                  const name =
                    person.name || person.email || "Member";

                  const isCurrentUser =
                    String(person._id) === String(currentUserId);

                  return (
                    <div
                      className="team-member-row"
                      key={person._id}
                    >
                      <div className="team-member-info">
                        <div className="team-avatar">
                          {person.avatar ? (
                            <img
                              src={person.avatar}
                              alt={name}
                            />
                          ) : (
                            name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div>
                          <strong>
                            {name}
                            {isCurrentUser && " (You)"}
                          </strong>

                          <span>{person.email}</span>
                        </div>
                      </div>

                      <div>
                        <span
                          className={`team-role role-${(
                            member.role || "member"
                          ).toLowerCase()}`}
                        >
                          {member.role}
                        </span>
                      </div>

                      <div>
                        {!isOwner && !isCurrentUser && (
                          <button
                            className="team-remove"
                            title="Remove member"
                            onClick={() =>
                              handleRemove(person._id, name)
                            }
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                        )}

                        {isOwner && (
                          <span className="team-protected">
                            Workspace owner
                          </span>
                        )}

                        {!isOwner && isCurrentUser && (
                          <span className="team-protected">
                            Your account
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {members.length === 0 && (
                  <div className="team-empty">
                    No team members found.
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
