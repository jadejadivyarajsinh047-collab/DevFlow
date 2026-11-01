import "dotenv/config";
import http from "http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";

import app from "./app.js";
import { connectDB } from "./config/db.js";

import Workspace from "./models/Workspace.js";
import Project from "./models/Project.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// Tracks every active Socket.IO connection for each user.
// A user is offline only when their final connection disconnects.
const userSockets = new Map();

function addUserSocket(userId, socketId) {
  const connections = userSockets.get(userId) || new Set();
  const wasOffline = connections.size === 0;

  connections.add(socketId);
  userSockets.set(userId, connections);

  return wasOffline;
}

function removeUserSocket(userId, socketId) {
  const connections = userSockets.get(userId);

  if (!connections) return false;

  connections.delete(socketId);

  if (connections.size === 0) {
    userSockets.delete(userId);
    return true;
  }

  return false;
}

// Notify members of every workspace the user belongs to.
async function broadcastPresence(userId, status) {
  try {
    const workspaces = await Workspace.find({
      "members.user": userId,
    }).select("_id");

    workspaces.forEach((workspace) => {
      io.to(`workspace:${workspace._id}`).emit("presence:update", {
        userId: String(userId),
        status,
        workspaceId: String(workspace._id),
      });
    });
  } catch (error) {
    console.error("Presence broadcast error:", error.message);
  }
}

// Authenticate every Socket.IO connection.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required."));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id) {
      return next(new Error("Invalid authentication token."));
    }

    socket.data.userId = String(decoded.id);

    next();
  } catch {
    next(new Error("Invalid or expired authentication token."));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.data.userId;

  console.log("Socket connected:", userId);

  // Private room for notifications and direct messages.
  socket.join(`user:${userId}`);

  // Track this connection.
  const isFirstConnection = addUserSocket(userId, socket.id);

  // Broadcast online only when the user's first connection starts.
  if (isFirstConnection) {
    await broadcastPresence(userId, "online");
  }

  // Join only workspaces where this user is a member.
  socket.on("workspace:join", async (workspaceId) => {
    try {
      if (!mongoose.isValidObjectId(workspaceId)) return;

      const workspace = await Workspace.findOne({
        _id: workspaceId,
        "members.user": userId,
      }).select("_id members.user");

      if (!workspace) {
        socket.emit("workspace:error", {
          message: "You are not a member of this workspace.",
        });

        return;
      }

      // Leave previously joined workspace.
      const previousWorkspaceId = socket.data.workspaceId;

      if (previousWorkspaceId) {
        socket.leave(`workspace:${previousWorkspaceId}`);
      }

      const room = `workspace:${workspace._id}`;

      await socket.join(room);

      socket.data.workspaceId = workspace._id.toString();

      socket.emit("workspace:joined", {
        workspaceId: workspace._id.toString(),
      });

      // Send the current online members to this connection.
      const onlineUserIds = workspace.members
        .map((member) => String(member.user))
        .filter((memberId) => userSockets.has(memberId));

      socket.emit("presence:initial", {
        workspaceId: workspace._id.toString(),
        onlineUserIds,
      });

      console.log(`User ${userId} joined workspace ${workspace._id}`);
    } catch (error) {
      console.error("Workspace socket join error:", error.message);

      socket.emit("workspace:error", {
        message: "Unable to join workspace.",
      });
    }
  });

  socket.on("workspace:leave", (workspaceId) => {
    if (!workspaceId) return;

    socket.leave(`workspace:${workspaceId}`);

    if (socket.data.workspaceId === String(workspaceId)) {
      socket.data.workspaceId = null;
    }
  });

  // Real-time typing indicator.
  socket.on("chat:typing", async (data = {}) => {
    try {
      const {
        workspaceId,
        type = "workspace",
        projectId,
        recipientId,
        isTyping,
      } = data;

      if (!mongoose.isValidObjectId(workspaceId)) return;

      const workspace = await Workspace.findOne({
        _id: workspaceId,
        "members.user": userId,
      }).select("_id members.user");

      if (!workspace) return;

      const typingEvent = {
        userId,
        workspaceId: String(workspaceId),
        type,
        projectId: projectId || null,
        recipientId: recipientId || null,
        isTyping: Boolean(isTyping),
      };

      if (type === "project") {
        if (!mongoose.isValidObjectId(projectId)) return;

        const project = await Project.findOne({
          _id: projectId,
          workspace: workspaceId,
        }).select("_id");

        if (!project) return;

        io.to(`workspace:${workspaceId}`).emit(
          "chat:typing",
          typingEvent,
        );
      } else if (type === "direct") {
        if (
          !mongoose.isValidObjectId(recipientId) ||
          String(recipientId) === userId
        ) {
          return;
        }

        const recipientIsMember = workspace.members.some(
          (member) => String(member.user) === String(recipientId),
        );

        if (!recipientIsMember) return;

        io.to(`user:${userId}`).emit("chat:typing", typingEvent);
        io.to(`user:${recipientId}`).emit("chat:typing", typingEvent);
      } else if (type === "workspace") {
        io.to(`workspace:${workspaceId}`).emit(
          "chat:typing",
          typingEvent,
        );
      }
    } catch (error) {
      console.error("Chat typing event error:", error.message);
    }
  });

  socket.on("disconnect", async () => {
    console.log("Socket disconnected:", userId);

    // Only mark offline when the user's last connection closes.
    const isLastConnection = removeUserSocket(userId, socket.id);

    if (isLastConnection) {
      await broadcastPresence(userId, "offline");
    }
  });
});

// Connect MongoDB before starting the server.
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`DevFlow API running on http://localhost:${PORT}`);
      console.log("Socket.io real-time collaboration enabled.");
      console.log("Real-time chat events enabled.");
      console.log("Real-time online/offline presence enabled.");
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  });