
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";

import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import MyTasks from "./pages/MyTasks";
import Projects from "./pages/Projects";
import Placeholder from "./pages/Placeholder";
import Board from "./pages/Board";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import Activity from "./pages/Activity";
import Calendar from "./pages/Calendar";
import Chat from "./pages/Chat";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />

      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Dashboard />} />

          <Route path="projects" element={<Projects />} />

          <Route
            path="projects/:projectId/board"
            element={<Board />}
          />

          <Route path="my-tasks" element={<MyTasks />} />

          <Route path="team" element={<Team />} />

          <Route
            path="workspaces/:workspaceId/team"
            element={<Team />}
          />

          <Route path="calendar" element={<Calendar />} />

          {/* Real-Time Team Chat */}
          <Route path="chat" element={<Chat />} />

          <Route path="activity" element={<Activity />} />

          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to="/app" replace />}
      />
    </Routes>
  );
}
