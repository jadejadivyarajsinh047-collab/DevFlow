import React, { useEffect, useState } from "react";
import {
  UserRound,
  LockKeyhole,
  Palette,
  Users,
  Bell,
  LogOut,
  Save,
  Trash2,
  UserPlus,
  Camera,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Building2,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import "../styles/settings.css";

const defaultNotifications = {
  taskUpdates: true,
  comments: true,
  mentions: true,
  workspaceUpdates: true,
};

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="settings-card">
      <div className="settings-card-heading">
        <div className="settings-section-icon">
          <Icon size={20} />
        </div>

        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="settings-card-body">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Profile
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    avatar: "",
  });

  // Password
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Workspaces
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    description: "",
  });

  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceDeleting, setWorkspaceDeleting] = useState(false);

  // Members
  const [members, setMembers] = useState([]);
  const [invite, setInvite] = useState({
    email: "",
    role: "Member",
  });

  // Notifications
  const [notifications, setNotifications] = useState(
    defaultNotifications,
  );

  // Loading and messages
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [passwordMessage, setPasswordMessage] = useState({
    type: "",
    text: "",
  });

  // --------------------------------------------------
  // Load user information
  // --------------------------------------------------

  useEffect(() => {
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      avatar: user?.avatar || "",
    });

    setNotifications({
      ...defaultNotifications,
      ...(user?.notificationPreferences || {}),
    });
  }, [user]);

  // --------------------------------------------------
  // Load workspaces
  // --------------------------------------------------

  useEffect(() => {
    let active = true;

    const loadWorkspaces = async () => {
      try {
        const response = await api.get("/workspaces");

        if (!active) return;

        const items = response.data.workspaces || [];

        setWorkspaces(items);

        if (items.length > 0) {
          setWorkspaceId(String(items[0]._id));
        } else {
          setWorkspaceId("");
        }
      } catch (error) {
        if (active) {
          setMessage({
            type: "error",
            text:
              error.response?.data?.message ||
              "Unable to load workspaces.",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadWorkspaces();

    return () => {
      active = false;
    };
  }, []);

  // --------------------------------------------------
  // Sync selected workspace form
  // --------------------------------------------------

  useEffect(() => {
    const selectedWorkspace = workspaces.find(
      (item) => String(item._id) === String(workspaceId),
    );

    if (selectedWorkspace) {
      setWorkspaceForm({
        name: selectedWorkspace.name || "",
        description: selectedWorkspace.description || "",
      });
    } else {
      setWorkspaceForm({
        name: "",
        description: "",
      });
    }
  }, [workspaceId, workspaces]);

  // --------------------------------------------------
  // Load workspace members
  // --------------------------------------------------

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }

    let active = true;

    const loadMembers = async () => {
      setMembersLoading(true);

      try {
        const response = await api.get(
          `/workspaces/${workspaceId}/members`,
        );

        if (active) {
          setMembers(response.data.members || []);
        }
      } catch (error) {
        if (active) {
          setMembers([]);

          setMessage({
            type: "error",
            text:
              error.response?.data?.message ||
              "Unable to load workspace members.",
          });
        }
      } finally {
        if (active) {
          setMembersLoading(false);
        }
      }
    };

    loadMembers();

    return () => {
      active = false;
    };
  }, [workspaceId]);

  // --------------------------------------------------
  // Common message handler
  // --------------------------------------------------

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  // --------------------------------------------------
  // Profile functions
  // --------------------------------------------------

  const handleProfileChange = (event) => {
    const { name, value } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    setSaving(true);
    showMessage("", "");

    try {
      const response = await api.patch("/auth/profile", profile);

      updateUser(response.data.user);

      showMessage("success", "Profile updated successfully.");
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Unable to update profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // Password functions
  // --------------------------------------------------

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswords((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const changePassword = async (event) => {
    event.preventDefault();

    setPasswordMessage({
      type: "",
      text: "",
    });

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password and confirm password do not match.",
      });

      return;
    }

    if (passwords.newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "New password must contain at least 8 characters.",
      });

      return;
    }

    setSaving(true);

    try {
      const response = await api.patch("/auth/password", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setPasswordMessage({
        type: "success",
        text: response.data.message || "Password changed successfully.",
      });
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Unable to change password.",
      });
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // Notification functions
  // --------------------------------------------------

  const saveNotification = async (field, value) => {
    const previous = notifications[field];

    setNotifications((current) => ({
      ...current,
      [field]: value,
    }));

    try {
      const response = await api.patch("/auth/notifications", {
        [field]: value,
      });

      setNotifications({
        ...defaultNotifications,
        ...response.data.preferences,
      });

      updateUser({
        notificationPreferences: response.data.preferences,
      });
    } catch (error) {
      setNotifications((current) => ({
        ...current,
        [field]: previous,
      }));

      showMessage(
        "error",
        error.response?.data?.message ||
          "Unable to save notification preferences.",
      );
    }
  };

  // --------------------------------------------------
  // Workspace functions
  // --------------------------------------------------

  const handleWorkspaceChange = (event) => {
    const { name, value } = event.target;

    setWorkspaceForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveWorkspace = async (event) => {
    event.preventDefault();

    if (!workspaceId) {
      showMessage("error", "Please select a workspace.");
      return;
    }

    const workspaceName = workspaceForm.name.trim();

    if (!workspaceName) {
      showMessage("error", "Workspace name is required.");
      return;
    }

    setWorkspaceSaving(true);
    showMessage("", "");

    try {
      const response = await api.patch(
        `/workspaces/${workspaceId}`,
        {
          name: workspaceName,
          description: workspaceForm.description.trim(),
        },
      );

      const updatedWorkspace = response.data.workspace || {
        _id: workspaceId,
        name: workspaceName,
        description: workspaceForm.description.trim(),
      };

      setWorkspaces((current) =>
        current.map((workspace) =>
          String(workspace._id) === String(workspaceId)
            ? { ...workspace, ...updatedWorkspace }
            : workspace,
        ),
      );

      setWorkspaceForm({
        name: updatedWorkspace.name || workspaceName,
        description:
          updatedWorkspace.description ??
          workspaceForm.description.trim(),
      });

      showMessage("success", "Workspace updated successfully.");
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Unable to update workspace.",
      );
    } finally {
      setWorkspaceSaving(false);
    }
  };

  const deleteCurrentWorkspace = async () => {
    if (!workspaceId) return;

    const selectedWorkspace = workspaces.find(
      (item) => String(item._id) === String(workspaceId),
    );

    const workspaceName = selectedWorkspace?.name || "this workspace";

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${workspaceName}"?\n\nThis action cannot be undone. Its projects, tasks, comments, messages, activities and workspace notifications will also be deleted.`,
    );

    if (!confirmed) return;

    setWorkspaceDeleting(true);
    showMessage("", "");

    try {
      await api.delete(`/workspaces/${workspaceId}`);

      const remainingWorkspaces = workspaces.filter(
        (workspace) => String(workspace._id) !== String(workspaceId),
      );

      setWorkspaces(remainingWorkspaces);

      if (remainingWorkspaces.length > 0) {
        setWorkspaceId(String(remainingWorkspaces[0]._id));
      } else {
        setWorkspaceId("");
        setMembers([]);
      }

      showMessage(
        "success",
        "Workspace and its related data deleted successfully.",
      );
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Unable to delete workspace.",
      );
    } finally {
      setWorkspaceDeleting(false);
    }
  };

  // --------------------------------------------------
  // Workspace member functions
  // --------------------------------------------------

  const inviteMember = async (event) => {
    event.preventDefault();

    if (!workspaceId || !invite.email.trim()) return;

    setSaving(true);
    showMessage("", "");

    try {
      const response = await api.post(
        `/workspaces/${workspaceId}/members`,
        {
          email: invite.email.trim(),
          role: invite.role,
        },
      );

      setMembers(response.data.members || []);

      setInvite({
        email: "",
        role: "Member",
      });

      showMessage("success", "Workspace member added successfully.");
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Unable to add member.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member) => {
    const memberUser = member.user;

    if (!memberUser?._id) return;

    const confirmed = window.confirm(
      `Remove ${memberUser.name} from this workspace?`,
    );

    if (!confirmed) return;

    try {
      await api.delete(
        `/workspaces/${workspaceId}/members/${memberUser._id}`,
      );

      setMembers((current) =>
        current.filter(
          (item) => String(item.user?._id) !== String(memberUser._id),
        ),
      );

      showMessage("success", "Member removed successfully.");
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Unable to remove member.",
      );
    }
  };

  // --------------------------------------------------
  // Current member permissions
  // --------------------------------------------------

  const currentMember = members.find(
    (item) =>
      String(item.user?._id) === String(user?.id),
  );

  const canManageMembers = ["Owner", "Admin"].includes(
    currentMember?.role,
  );

  const isWorkspaceOwner = currentMember?.role === "Owner";

  // --------------------------------------------------
  // Profile initials
  // --------------------------------------------------

  const initials =
    user?.name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "DF";

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="settings-page">
      <div className="settings-page-heading">
        <div>
          <span className="settings-eyebrow">DEVFLOW WORKSPACE</span>
          <h1>Settings</h1>
          <p>Manage your profile, preferences and workspace.</p>
        </div>
      </div>

      {/* Global message */}
      {message.text && (
        <div className={`settings-alert ${message.type}`}>
          {message.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          {message.text}

          <button onClick={() => showMessage("", "")}>×</button>
        </div>
      )}

      {loading ? (
        <div className="settings-loading">
          <LoaderCircle className="settings-spinner" size={26} />
          Loading settings...
        </div>
      ) : (
        <div className="settings-layout">
          {/* =========================================
              MAIN COLUMN
          ========================================== */}

          <div className="settings-main-column">
            {/* Profile details */}
            <Section
              icon={UserRound}
              title="Profile details"
              description="Update your personal account information."
            >
              <form onSubmit={saveProfile}>
                <div className="profile-preview">
                  <div className="profile-avatar">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt="Profile"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  <div>
                    <b>{profile.name || "Your name"}</b>
                    <p>{profile.email || "Your email"}</p>
                  </div>

                  <Camera size={18} />
                </div>

                <div className="settings-form-grid">
                  <label className="settings-field">
                    Full name

                    <input
                      name="name"
                      value={profile.name}
                      onChange={handleProfileChange}
                      placeholder="Enter your name"
                      required
                      maxLength={80}
                    />
                  </label>

                  <label className="settings-field">
                    Email address

                    <input
                      type="email"
                      name="email"
                      value={profile.email}
                      onChange={handleProfileChange}
                      placeholder="Enter your email"
                      required
                    />
                  </label>

                  <label className="settings-field full-field">
                    Avatar image URL

                    <input
                      type="url"
                      name="avatar"
                      value={profile.avatar}
                      onChange={handleProfileChange}
                      placeholder="https://example.com/avatar.png"
                    />
                  </label>
                </div>

                <div className="settings-actions">
                  <button
                    type="submit"
                    className="settings-primary-btn"
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </form>
            </Section>

            {/* Change password */}
            <Section
              icon={LockKeyhole}
              title="Change password"
              description="Choose a strong password to keep your account secure."
            >
              {passwordMessage.text && (
                <div
                  className={`settings-inline-message ${passwordMessage.type}`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <form onSubmit={changePassword}>
                <div className="settings-form-grid">
                  <label className="settings-field full-field">
                    Current password

                    <input
                      type="password"
                      name="currentPassword"
                      value={passwords.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Enter current password"
                      required
                    />
                  </label>

                  <label className="settings-field">
                    New password

                    <input
                      type="password"
                      name="newPassword"
                      value={passwords.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      required
                    />
                  </label>

                  <label className="settings-field">
                    Confirm new password

                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwords.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Confirm new password"
                      required
                    />
                  </label>
                </div>

                <div className="settings-actions">
                  <button
                    type="submit"
                    className="settings-primary-btn"
                    disabled={saving}
                  >
                    <LockKeyhole size={16} />
                    Update password
                  </button>
                </div>
              </form>
            </Section>

            {/* Workspace members */}
            <Section
              icon={Users}
              title="Workspace members"
              description="Invite registered users and manage workspace access."
            >
              {workspaces.length === 0 ? (
                <p className="settings-muted">
                  You do not belong to any workspace yet.
                </p>
              ) : (
                <>
                  <label className="settings-field">
                    Select workspace

                    <select
                      value={workspaceId}
                      onChange={(event) =>
                        setWorkspaceId(event.target.value)
                      }
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
                  </label>

                  {canManageMembers && (
                    <form
                      className="invite-member-form"
                      onSubmit={inviteMember}
                    >
                      <label className="settings-field">
                        Invite by registered email

                        <input
                          type="email"
                          value={invite.email}
                          onChange={(event) =>
                            setInvite((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          placeholder="member@example.com"
                          required
                        />
                      </label>

                      <label className="settings-field">
                        Role

                        <select
                          value={invite.role}
                          onChange={(event) =>
                            setInvite((current) => ({
                              ...current,
                              role: event.target.value,
                            }))
                          }
                        >
                          <option value="Member">Member</option>
                          <option value="Manager">Manager</option>

                          {currentMember?.role === "Owner" && (
                            <option value="Admin">Admin</option>
                          )}

                          <option value="Viewer">Viewer</option>
                        </select>
                      </label>

                      <button
                        type="submit"
                        className="settings-primary-btn"
                        disabled={saving}
                      >
                        <UserPlus size={16} />
                        Invite member
                      </button>
                    </form>
                  )}

                  <div className="members-list-heading">
                    <h3>People in this workspace</h3>
                    <span>{members.length} members</span>
                  </div>

                  {membersLoading ? (
                    <p className="settings-muted">
                      Loading members...
                    </p>
                  ) : members.length === 0 ? (
                    <p className="settings-muted">
                      No members found.
                    </p>
                  ) : (
                    <div className="settings-members-list">
                      {members.map((member) => {
                        const person = member.user;

                        if (!person) return null;

                        const isSelf =
                          String(person._id) === String(user?.id);

                        return (
                          <div
                            className="settings-member-row"
                            key={person._id}
                          >
                            <div className="member-avatar">
                              {person.avatar ? (
                                <img src={person.avatar} alt="" />
                              ) : (
                                person.name?.charAt(0).toUpperCase()
                              )}
                            </div>

                            <div className="member-details">
                              <b>
                                {person.name}
                                {isSelf && " (You)"}
                              </b>

                              <span>{person.email}</span>
                            </div>

                            <span className="member-role">
                              {member.role}
                            </span>

                            {canManageMembers &&
                              member.role !== "Owner" &&
                              !(
                                currentMember?.role === "Admin" &&
                                member.role === "Admin"
                              ) && (
                                <button
                                  type="button"
                                  className="member-remove-btn"
                                  title="Remove member"
                                  onClick={() => removeMember(member)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* Workspace settings */}
            <Section
              icon={Building2}
              title="Workspace settings"
              description="Update your selected workspace details or delete it."
            >
              {workspaces.length === 0 ? (
                <p className="settings-muted">
                  Create a workspace first to manage its settings.
                </p>
              ) : (
                <>
                  <p className="settings-muted">
                    You are editing the workspace selected in the
                    Workspace members section.
                  </p>

                  <form onSubmit={saveWorkspace}>
                    <div className="settings-form-grid workspace-settings-fields">
                      <label className="settings-field full-field">
                        Workspace name

                        <input
                          type="text"
                          name="name"
                          value={workspaceForm.name}
                          onChange={handleWorkspaceChange}
                          placeholder="Enter workspace name"
                          maxLength={100}
                          required
                        />
                      </label>

                      <label className="settings-field full-field">
                        Workspace description

                        <textarea
                          name="description"
                          value={workspaceForm.description}
                          onChange={handleWorkspaceChange}
                          placeholder="Describe what this workspace is used for..."
                          rows={4}
                          maxLength={500}
                        />
                      </label>
                    </div>

                    <div className="settings-actions">
                      <button
                        type="submit"
                        className="settings-primary-btn"
                        disabled={workspaceSaving || !workspaceId}
                      >
                        {workspaceSaving ? (
                          <LoaderCircle
                            className="settings-spinner"
                            size={16}
                          />
                        ) : (
                          <Save size={16} />
                        )}

                        {workspaceSaving
                          ? "Saving..."
                          : "Save workspace"}
                      </button>
                    </div>
                  </form>

                  {isWorkspaceOwner && (
                    <div className="workspace-delete-area">
                      <div>
                        <b>Danger zone</b>

                        <p>
                          Permanently delete this workspace, including
                          its projects, tasks, comments, messages and
                          related workspace data. This action cannot
                          be undone.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="settings-danger-btn"
                        onClick={deleteCurrentWorkspace}
                        disabled={
                          workspaceDeleting || !workspaceId
                        }
                      >
                        {workspaceDeleting ? (
                          <LoaderCircle
                            className="settings-spinner"
                            size={17}
                          />
                        ) : (
                          <Trash2 size={17} />
                        )}

                        {workspaceDeleting
                          ? "Deleting workspace..."
                          : "Delete workspace"}
                      </button>
                    </div>
                  )}

                  {!isWorkspaceOwner && (
                    <p className="settings-muted">
                      Only the workspace Owner can permanently delete
                      this workspace.
                    </p>
                  )}
                </>
              )}
            </Section>
          </div>

          {/* =========================================
              SIDE COLUMN
          ========================================== */}

          <div className="settings-side-column">
            {/* Appearance */}
            <Section
              icon={Palette}
              title="Appearance"
              description="Choose how DevFlow looks on your device."
            >
              <div className="theme-options">
                <button
                  type="button"
                  className={`theme-option ${
                    theme === "light" ? "selected" : ""
                  }`}
                  onClick={() => {
                    if (theme !== "light") toggleTheme();
                  }}
                >
                  <span className="theme-preview light-preview">
                    <i />
                    <i />
                    <i />
                  </span>

                  <span>Light</span>
                </button>

                <button
                  type="button"
                  className={`theme-option ${
                    theme === "dark" ? "selected" : ""
                  }`}
                  onClick={() => {
                    if (theme !== "dark") toggleTheme();
                  }}
                >
                  <span className="theme-preview dark-preview">
                    <i />
                    <i />
                    <i />
                  </span>

                  <span>Dark</span>
                </button>
              </div>

              <p className="settings-muted">
                Your theme preference is saved automatically.
              </p>
            </Section>

            {/* Notifications */}
            <Section
              icon={Bell}
              title="Notifications"
              description="Choose which updates you want to receive."
            >
              <div className="notification-options">
                {[
                  {
                    key: "taskUpdates",
                    title: "Task updates",
                    description: "Changes to tasks assigned to you.",
                  },
                  {
                    key: "comments",
                    title: "Comments",
                    description: "New comments on your tasks.",
                  },
                  {
                    key: "mentions",
                    title: "Mentions",
                    description: "When someone mentions you.",
                  },
                  {
                    key: "workspaceUpdates",
                    title: "Workspace updates",
                    description: "Changes in your workspace.",
                  },
                ].map((item) => (
                  <label
                    className="notification-option"
                    key={item.key}
                  >
                    <span>
                      <b>{item.title}</b>
                      <small>{item.description}</small>
                    </span>

                    <input
                      type="checkbox"
                      checked={Boolean(notifications[item.key])}
                      onChange={(event) =>
                        saveNotification(
                          item.key,
                          event.target.checked,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </Section>

            {/* Account */}
            <Section
              icon={LogOut}
              title="Account"
              description="Manage your current session."
            >
              <div className="account-info">
                <span>Signed in as</span>
                <b>{user?.email}</b>
              </div>

              <button
                type="button"
                className="settings-danger-btn"
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
              >
                <LogOut size={17} />
                Sign out of DevFlow
              </button>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}