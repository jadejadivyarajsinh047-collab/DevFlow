import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  FolderKanban,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../services/api";
import "../styles/secondary.css";
export default function Projects() {
  const [items, setItems] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspace, setWorkspace] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get("/workspaces")
      .then(async (r) => {
        setWorkspaces(r.data.workspaces);
        const id = r.data.workspaces[0]?._id;
        if (id) {
          setWorkspace(id);
          const p = await api.get(`/projects/workspace/${id}`);
          setItems(p.data.projects);
        }
      })
      .catch((e) =>
        setError(e.response?.data?.message || "Unable to load projects."),
      );
  }, []);
  const filtered = items.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="secondary-page">
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">YOUR WORKSPACE</div>
          <h1>Projects</h1>
          <p>All the work your team is moving forward.</p>
        </div>
        <Link className="primary-btn" to="/app">
          <Plus size={16} /> New project
        </Link>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
          />
        </div>
        <button className="secondary-btn">
          <SlidersHorizontal size={16} /> Filter
        </button>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="projects-grid">
        {filtered.map((p, i) => (
          <article className="project-card" key={p._id}>
            <div className="project-card-top">
              <div
                className="project-symbol large"
                style={{ color: p.color, background: `${p.color}20` }}
              >
                <FolderKanban size={20} />
              </div>
              <button className="icon-btn">
                <ArrowUpRight size={17} />
              </button>
            </div>
            <h3>{p.name}</h3>

<p>
  {p.description ||
    "A shared space for focused, collaborative work."}
</p>

<Link
  className="secondary-btn"
  to={`/app/projects/${p._id}/board`}
>
  Open Board <ArrowUpRight size={15} />
</Link>
            <div className="project-card-meta">
              <span
                className={`status-chip ${p.status === "Completed" ? "done" : p.status === "In progress" ? "active" : "planning"}`}
              >
                {p.status}
              </span>
              <span>{p.priority} priority</span>
            </div>
            <div className="project-card-bottom">
              <div className="mini-avatars">
                <i>Y</i>
                <i>+</i>
              </div>
              <span>Created {new Date(p.createdAt).toLocaleDateString()}</span>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && !error && (
        <div className="empty-workspace">
          <div className="empty-icon">
            <FolderKanban size={24} />
          </div>
          <h2>{query ? "No matching projects" : "No projects yet"}</h2>
          <p>
            {query
              ? "Try a different search term."
              : "Create your first project from the overview dashboard."}
          </p>
          <Link className="secondary-btn" to="/app">
            Go to overview
          </Link>
        </div>
      )}
    </div>
  );
}
