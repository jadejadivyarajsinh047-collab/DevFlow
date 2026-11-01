
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Hash,
  MessageCircle,
  Send,
  Users,
  Trash2,
  LoaderCircle,
} from "lucide-react";
import api from "../services/api";
import "./Chat.css";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const getId = (value) => {
  if (!value) return "";
  return String(value._id || value.id || value);
};

function Chat() {
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);

  const [workspaceId, setWorkspaceId] = useState("");
  const [chatType, setChatType] = useState("workspace");
  const [projectId, setProjectId] = useState("");
  const [recipientId, setRecipientId] = useState("");

  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);

  // Online/offline status of workspace members
  const [onlineUsers, setOnlineUsers] = useState({});

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((item) => getId(item) === workspaceId),
    [workspaces, workspaceId],
  );

  const selectedProject = useMemo(
    () => projects.find((item) => getId(item) === projectId),
    [projects, projectId],
  );

  const selectedMember = useMemo(
    () =>
      members.find(
        (item) => getId(item.user || item) === recipientId,
      ),
    [members, recipientId],
  );

  // Check whether a user is online
  const isUserOnline = useCallback(
    (userId) => Boolean(onlineUsers[String(userId)]),
    [onlineUsers],
  );

  // STEP 1: Load workspaces
  useEffect(() => {
    async function loadWorkspaces() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/workspaces");
        const list = response.data.workspaces || [];

        setWorkspaces(list);

        if (list.length > 0) {
          setWorkspaceId(getId(list[0]));
        } else {
          setError("No workspace found. Please create a workspace first.");
        }
      } catch (err) {
        console.error("Workspace loading error:", err);
        setError(
          err.response?.data?.message || "Unable to load workspaces.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadWorkspaces();
  }, []);

  // STEP 2: Load projects and workspace members
  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function loadWorkspaceData() {
      try {
        setError("");

        const [projectResponse, memberResponse] = await Promise.all([
          api.get(`/projects/workspace/${workspaceId}`),
          api.get(`/workspaces/${workspaceId}/members`),
        ]);

        if (cancelled) return;

        setProjects(projectResponse.data.projects || []);
        setMembers(memberResponse.data.members || []);
      } catch (err) {
        if (cancelled) return;

        console.error("Workspace data loading error:", err);

        setProjects([]);
        setMembers([]);

        setError(
          err.response?.data?.message ||
            "Unable to load projects or workspace members.",
        );
      }
    }

    loadWorkspaceData();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // STEP 3: Build current chat parameters
  const getChatParams = useCallback(() => {
    const params = { type: chatType };

    if (chatType === "project") {
      params.projectId = projectId;
    }

    if (chatType === "direct") {
      params.recipientId = recipientId;
    }

    return params;
  }, [chatType, projectId, recipientId]);

  // STEP 4: Load messages
  const loadMessages = useCallback(async () => {
    if (!workspaceId) return;

    if (chatType === "project" && !projectId) {
      setMessages([]);
      return;
    }

    if (chatType === "direct" && !recipientId) {
      setMessages([]);
      return;
    }

    try {
      setError("");

      const response = await api.get(
        `/chat/workspaces/${workspaceId}/messages`,
        {
          params: getChatParams(),
        },
      );

      setMessages(response.data.messages || []);
    } catch (err) {
      console.error("Chat messages error:", err);

      setMessages([]);

      setError(
        err.response?.data?.message || "Unable to load messages.",
      );
    }
  }, [workspaceId, chatType, projectId, recipientId, getChatParams]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // STEP 5: Socket.IO connection and presence
  useEffect(() => {
    const token = localStorage.getItem("devflow_token");

    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Chat socket connected:", socket.id);

      // Backend expects workspaceId as a string.
      if (workspaceId) {
        socket.emit("workspace:join", workspaceId);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Chat socket connection error:", err.message);
    });

    // Receive initial online members when joining a workspace
    socket.on("presence:initial", (data) => {
      if (String(data.workspaceId) !== String(workspaceId)) return;

      const onlineMap = {};

      (data.onlineUserIds || []).forEach((userId) => {
        onlineMap[String(userId)] = true;
      });

      setOnlineUsers(onlineMap);
    });

    // Receive live online/offline updates
    socket.on("presence:update", (data) => {
      if (String(data.workspaceId) !== String(workspaceId)) return;

      setOnlineUsers((previous) => ({
        ...previous,
        [String(data.userId)]: data.status === "online",
      }));

      console.log(
        `User ${data.userId} is now ${data.status}`,
      );
    });

    // Receive new messages
    socket.on("chat:message:new", (message) => {
      if (getId(message.workspace) !== workspaceId) return;
      if (message.type !== chatType) return;

      if (
        chatType === "project" &&
        getId(message.project) !== projectId
      ) {
        return;
      }

      if (chatType === "direct") {
        const participants = [
          getId(message.sender),
          getId(message.recipient),
        ];

        if (!participants.includes(recipientId)) return;
      }

      setMessages((previous) => {
        const exists = previous.some(
          (item) => getId(item) === getId(message),
        );

        if (exists) return previous;

        return [...previous, message];
      });
    });

    // Receive deleted message events
    socket.on("chat:message:deleted", ({ messageId }) => {
      setMessages((previous) =>
        previous.filter((item) => getId(item) !== String(messageId)),
      );
    });

    // Receive typing events
    socket.on("chat:typing", (data) => {
      if (data.workspaceId !== workspaceId) return;
      if (data.type !== chatType) return;

      if (
        chatType === "project" &&
        data.projectId !== projectId
      ) {
        return;
      }

      if (
        chatType === "direct" &&
        data.recipientId !== recipientId
      ) {
        return;
      }

      setTyping(Boolean(data.isTyping));
    });

    return () => {
      socket.off("presence:initial");
      socket.off("presence:update");
      socket.off("chat:message:new");
      socket.off("chat:message:deleted");
      socket.off("chat:typing");

      socket.disconnect();
      socketRef.current = null;
    };
  }, [workspaceId, chatType, projectId, recipientId]);

  // STEP 6: Join selected workspace room
  useEffect(() => {
    const socket = socketRef.current;

    if (socket?.connected && workspaceId) {
      socket.emit("workspace:join", workspaceId);
    }
  }, [workspaceId]);

  // STEP 7: Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // STEP 8: Typing event
  function handleTyping(value) {
    setMessageText(value);

    const socket = socketRef.current;

    if (socket?.connected && workspaceId) {
      socket.emit("chat:typing", {
        workspaceId,
        type: chatType,
        projectId: chatType === "project" ? projectId : undefined,
        recipientId: chatType === "direct" ? recipientId : undefined,
        isTyping: true,
      });
    }

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      if (socket?.connected) {
        socket.emit("chat:typing", {
          workspaceId,
          type: chatType,
          projectId: chatType === "project" ? projectId : undefined,
          recipientId: chatType === "direct" ? recipientId : undefined,
          isTyping: false,
        });
      }
    }, 1000);
  }

  // STEP 9: Send message
  async function handleSendMessage(event) {
    event.preventDefault();

    const content = messageText.trim();

    if (!content || sending || !workspaceId) return;

    if (chatType === "project" && !projectId) return;
    if (chatType === "direct" && !recipientId) return;

    try {
      setSending(true);
      setError("");

      await api.post(
        `/chat/workspaces/${workspaceId}/messages`,
        {
          content,
          ...getChatParams(),
        },
      );

      setMessageText("");

      if (socketRef.current?.connected) {
        socketRef.current.emit("chat:typing", {
          workspaceId,
          type: chatType,
          projectId: chatType === "project" ? projectId : undefined,
          recipientId: chatType === "direct" ? recipientId : undefined,
          isTyping: false,
        });
      }

      await loadMessages();
    } catch (err) {
      console.error("Send message error:", err);

      setError(
        err.response?.data?.message || "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  // STEP 10: Delete own message
  async function handleDeleteMessage(messageId) {
    if (!window.confirm("Delete this message?")) return;

    try {
      await api.delete(`/chat/messages/${messageId}`);

      setMessages((previous) =>
        previous.filter((item) => getId(item) !== messageId),
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete message.",
      );
    }
  }

  function formatTime(date) {
    if (!date) return "";

    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getSenderName(message) {
    return (
      message.sender?.name ||
      message.sender?.email ||
      "User"
    );
  }

  if (loading) {
    return (
      <div className="chat-loading">
        <LoaderCircle className="chat-spin" size={28} />
        <p>Loading your workspace chat...</p>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-heading">
        <div>
          <h1>Messages</h1>
          <p>Stay connected with your workspace team.</p>
        </div>

        <div className="chat-status">
          <span className="chat-status-dot" />
          Real-time chat
        </div>
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-layout">
        {/* SIDEBAR */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-section">
            <label>WORKSPACE</label>

            <select
              value={workspaceId}
              onChange={(event) => {
                setWorkspaceId(event.target.value);
                setProjectId("");
                setRecipientId("");
                setChatType("workspace");
                setMessages([]);
                setOnlineUsers({});
              }}
            >
              {workspaces.map((workspace) => (
                <option
                  key={getId(workspace)}
                  value={getId(workspace)}
                >
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          {/* WORKSPACE CHANNEL */}
          <div className="chat-sidebar-section">
            <label>CHANNELS</label>

            <button
              type="button"
              className={`chat-nav-item ${
                chatType === "workspace" ? "active" : ""
              }`}
              onClick={() => {
                setChatType("workspace");
                setProjectId("");
                setRecipientId("");
              }}
            >
              <Hash size={17} />
              General
            </button>

            {/* PROJECT CHANNELS */}
            <div className="chat-section-title">
              <span>PROJECT CHANNELS ({projects.length})</span>
            </div>

            {projects.length === 0 ? (
              <p className="chat-sidebar-empty">
                No projects found in this workspace.
              </p>
            ) : (
              projects.map((project) => (
                <button
                  type="button"
                  key={getId(project)}
                  className={`chat-nav-item ${
                    chatType === "project" &&
                    projectId === getId(project)
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setChatType("project");
                    setProjectId(getId(project));
                    setRecipientId("");
                  }}
                >
                  <Hash size={17} />
                  <span>{project.name}</span>
                </button>
              ))
            )}
          </div>

          {/* DIRECT MESSAGES */}
          <div className="chat-sidebar-section">
            <label>DIRECT MESSAGES ({members.length})</label>

            {members.length === 0 ? (
              <p className="chat-sidebar-empty">
                No workspace members found.
              </p>
            ) : (
              members.map((member) => {
                const person = member.user || member;
                const id = getId(person);

                if (!id || !person.name) return null;

                const online = isUserOnline(id);

                return (
                  <button
                    type="button"
                    key={id}
                    className={`chat-nav-item ${
                      chatType === "direct" &&
                      recipientId === id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => {
                      setChatType("direct");
                      setRecipientId(id);
                      setProjectId("");
                    }}
                  >
                    <span className="chat-avatar small">
                      {person.name.charAt(0).toUpperCase()}
                    </span>

                    <span className="chat-member-name">
                      {person.name}

                      <span
                        className={`chat-presence-dot ${
                          online ? "online" : "offline"
                        }`}
                        title={online ? "Online" : "Offline"}
                        aria-label={online ? "Online" : "Offline"}
                      />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* CHAT WINDOW */}
        <section className="chat-main">
          <header className="chat-main-header">
            <div className="chat-channel-icon">
              {chatType === "direct" ? (
                <MessageCircle size={20} />
              ) : (
                <Hash size={20} />
              )}
            </div>

            <div>
              <h2>
                {chatType === "workspace"
                  ? "General"
                  : chatType === "project"
                    ? selectedProject?.name || "Project chat"
                    : selectedMember?.user?.name ||
                      selectedMember?.name ||
                      "Direct message"}
              </h2>

              <p>
                {selectedWorkspace?.name || "Workspace"} ·{" "}
                {chatType === "direct"
                  ? isUserOnline(recipientId)
                    ? "Online"
                    : "Offline"
                  : "Team conversation"}
              </p>
            </div>

            <div className="chat-member-count">
              <Users size={17} />
              {members.length}
            </div>
          </header>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-icon">
                  <MessageCircle size={30} />
                </div>

                <h3>No messages yet</h3>
                <p>Start the conversation with your team.</p>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  className="chat-message"
                  key={getId(message)}
                >
                  <div className="chat-avatar">
                    {getSenderName(message)
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="chat-message-content">
                    <div className="chat-message-meta">
                      <strong>{getSenderName(message)}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>

                    <p>{message.content}</p>

                    <button
                      type="button"
                      className="chat-delete"
                      title="Delete message"
                      onClick={() =>
                        handleDeleteMessage(getId(message))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))
            )}

            {typing && (
              <div className="chat-typing">
                Someone is typing...
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            className="chat-composer"
            onSubmit={handleSendMessage}
          >
            <input
              type="text"
              value={messageText}
              onChange={(event) =>
                handleTyping(event.target.value)
              }
              placeholder="Write a message..."
              maxLength={4000}
              disabled={
                (chatType === "project" && !projectId) ||
                (chatType === "direct" && !recipientId)
              }
            />

            <button
              type="submit"
              disabled={!messageText.trim() || sending}
              title="Send message"
            >
              {sending ? (
                <LoaderCircle className="chat-spin" size={19} />
              ) : (
                <Send size={19} />
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Chat;
