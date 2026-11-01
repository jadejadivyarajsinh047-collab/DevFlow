
import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Command,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  X,
  Zap,
  Trash2,
} from "lucide-react";

import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import "../styles/shell.css";

const navGroups = [
  {
    title: "WORKSPACE",
    links: [
      {
        to: "/app",
        label: "Overview",
        icon: LayoutDashboard,
        end: true,
      },
      {
        to: "/app/projects",
        label: "Projects",
        icon: FolderKanban,
      },
      {
        to: "/app/my-tasks",
        label: "My tasks",
        icon: Zap,
      },
      {
        to: "/app/calendar",
        label: "Calendar",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "COLLABORATE",
    links: [
      {
        to: "/app/team",
        label: "Team",
        icon: Users,
      },
      {
        to: "/app/chat",
        label: "Messages",
        icon: MessageSquare,
        badge: "3",
      },
      {
        to: "/app/activity",
        label: "Activity",
        icon: Activity,
      },
    ],
  },
];

function getNotificationId(notification) {
  return notification?._id || notification?.id;
}

function formatNotificationDate(date) {
  if (!date) return "";

  const notificationDate = new Date(date);

  if (Number.isNaN(notificationDate.getTime())) return "";

  return notificationDate.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const notificationRef = useRef(null);

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const initials =
    user?.name
      ?.split(" ")
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "DF";

  // Load notifications
  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);

      const [notificationResponse, countResponse] = await Promise.all([
        api.get("/notifications"),
        api.get("/notifications/unread-count"),
      ]);

      const notificationData = notificationResponse.data;

      setNotifications(
        Array.isArray(notificationData)
          ? notificationData
          : notificationData?.notifications || []
      );

      setUnreadCount(
        Number(
          countResponse.data?.count ??
            countResponse.data?.unreadCount ??
            0
        )
      );
    } catch (error) {
      console.error(
        "Unable to load notifications:",
        error.response?.data || error.message
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  // Fetch notifications and connect Socket.io
  useEffect(() => {
    if (!user) return;

    loadNotifications();

    const token = localStorage.getItem("devflow_token");

    if (!token) return;

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      api.defaults.baseURL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("notification:new", (notification) => {
      const notificationId = getNotificationId(notification);

      setNotifications((previous) => {
        if (
          notificationId &&
          previous.some(
            (item) => getNotificationId(item) === notificationId
          )
        ) {
          return previous;
        }

        return [notification, ...previous];
      });

      setUnreadCount((previous) => previous + 1);
    });

    socket.on("connect_error", (error) => {
      console.error("Notification socket error:", error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [user?._id, user?.id]);

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Mark one notification as read
  const markAsRead = async (notificationId) => {
    if (!notificationId) return;

    const selectedNotification = notifications.find(
      (item) => getNotificationId(item) === notificationId
    );

    if (!selectedNotification || selectedNotification.isRead) return;

    try {
      await api.patch(`/notifications/${notificationId}/read`);

      setNotifications((previous) =>
        previous.map((notification) =>
          getNotificationId(notification) === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
    }
  };

  // Delete one notification
  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);

      const deletedNotification = notifications.find(
        (item) => getNotificationId(item) === notificationId
      );

      setNotifications((previous) =>
        previous.filter(
          (item) => getNotificationId(item) !== notificationId
        )
      );

      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCount((previous) => Math.max(0, previous - 1));
      }
    } catch (error) {
      console.error("Unable to delete notification:", error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      await api.delete("/notifications/clear-all");

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Unable to clear notifications:", error);
    }
  };

  // Notification click navigation
  const handleNotificationClick = async (notification) => {
    const notificationId = getNotificationId(notification);

    if (!notification.isRead && notificationId) {
      await markAsRead(notificationId);
    }

    setNotificationsOpen(false);

    if (notification.task?._id) {
      navigate("/app/projects");
    } else if (notification.workspace?._id) {
      navigate("/app/team");
    }
  };

  const notificationTitle = (notification) => {
    const titles = {
      task_assigned: "Task assigned",
      task_comment: "New task comment",
      task_updated: "Task updated",
      task_deleted: "Task deleted",
      workspace_invitation: "Workspace invitation",
    };

    return titles[notification.type] || "New notification";
  };

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Command size={19} />
          </div>

          <span>devflow</span>

          <button
            className="mobile-close icon-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <button className="workspace-switch">
          <div className="workspace-avatar">S</div>

          <span>
            <b>Studio Workspace</b>
            <small>Free plan</small>
          </span>

          <ChevronDown size={15} />
        </button>

        <button
          className="quick-search"
          onClick={() => navigate("/app/projects")}
        >
          <Search size={16} />
          <span>Search anything...</span>
          <kbd>⌘ K</kbd>
        </button>

        {/* Navigation */}
        <nav className="side-nav">
          {navGroups.map((group) => (
            <section key={group.title}>
              <p className="nav-caption">{group.title}</p>

              {group.links.map(
                ({ to, label, icon: Icon, badge, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active" : ""}`
                    }
                  >
                    <Icon size={17} />

                    <span>{label}</span>

                    {badge && <em>{badge}</em>}
                  </NavLink>
                )
              )}
            </section>
          ))}
        </nav>

        {/* Sidebar bottom */}
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">
              <Zap size={16} />
            </div>

            <b>Unlock your team's potential</b>

            <p>
              Upgrade to Pro for unlimited projects and advanced insights.
            </p>

            <button onClick={() => navigate("/app/settings")}>
              Explore plans <span>→</span>
            </button>
          </div>

          <NavLink to="/app/settings" className="nav-link">
            <Settings size={17} />
            Settings
          </NavLink>

          <button className="nav-link help-link">
            <CircleHelp size={17} />
            Help &amp; support
          </button>
        </div>

        {/* Logged-in user */}
        <div className="sidebar-user">
          <div className="avatar">{initials}</div>

          <span>
            <b>{user?.name || "Your account"}</b>
            <small>{user?.email || "Welcome back"}</small>
          </span>

          <button
            className="icon-btn"
            title="Sign out"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main area */}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="crumb">
              Workspace <span>/</span> <b>Overview</b>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="top-search"
              onClick={() => navigate("/app/projects")}
            >
              <Search size={16} />
              <span>Search</span>
              <kbd>⌘ K</kbd>
            </button>

            {/* Theme toggle */}
            <button
              className="icon-btn theme-toggle"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {/* Notifications */}
            <div className="notification-wrapper" ref={notificationRef}>
              <button
                className="icon-btn notification-btn"
                title="Notifications"
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((previous) => !previous);

                  if (!notificationsOpen) {
                    loadNotifications();
                  }
                }}
              >
                <Bell size={18} />

                {unreadCount > 0 && (
                  <span className="notification-count">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <div>
                      <h3>Notifications</h3>

                      <p>
                        {unreadCount > 0
                          ? `${unreadCount} unread notifications`
                          : "You're all caught up"}
                      </p>
                    </div>

                    <button
                      className="notification-icon-action"
                      title="Mark all as read"
                      onClick={markAllAsRead}
                      disabled={unreadCount === 0}
                    >
                      <CheckCheck size={17} />
                    </button>
                  </div>

                  <div className="notification-list">
                    {notificationsLoading ? (
                      <div className="notification-empty">
                        Loading notifications...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="notification-empty">
                        <BellRing size={30} />

                        <b>No notifications yet</b>

                        <span>
                          Workspace invitations and task updates will appear
                          here.
                        </span>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const id = getNotificationId(notification);

                        return (
                          <div
                            key={id}
                            className={`notification-item ${
                              notification.isRead ? "" : "unread"
                            }`}
                          >
                            <button
                              className="notification-content"
                              onClick={() =>
                                handleNotificationClick(notification)
                              }
                            >
                              <span className="notification-dot" />

                              <span className="notification-text">
                                <b>
                                  {notificationTitle(notification)}
                                </b>

                                <span>{notification.message}</span>

                                <small>
                                  {notification.sender?.name
                                    ? `By ${notification.sender.name} · `
                                    : ""}
                                  {formatNotificationDate(
                                    notification.createdAt
                                  )}
                                </small>
                              </span>
                            </button>

                            <div className="notification-item-actions">
                              {!notification.isRead && (
                                <button
                                  title="Mark as read"
                                  onClick={() => markAsRead(id)}
                                >
                                  <Check size={15} />
                                </button>
                              )}

                              <button
                                title="Delete notification"
                                onClick={() => deleteNotification(id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="notification-footer">
                      <button onClick={clearAllNotifications}>
                        <Trash2 size={14} />
                        Clear all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="top-avatar">{initials}</div>
          </div>
        </header>

        {/* Page content */}
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
