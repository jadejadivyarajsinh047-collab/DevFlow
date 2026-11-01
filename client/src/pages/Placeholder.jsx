import React from "react";
import { Construction, Sparkles } from "lucide-react";
import "../styles/secondary.css";
export default function Placeholder({ title, description }) {
  return (
    <div className="secondary-page">
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">DEVFLOW WORKSPACE</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <div className="feature-placeholder">
        <div className="placeholder-icon">
          <Construction size={26} />
        </div>
        <h2>Designed for the complete DevFlow experience</h2>
        <p>
          This module is included in the product roadmap. The core workspace,
          authentication, projects and task workflows are ready to use in this
          starter build.
        </p>
        <div className="placeholder-tag">
          <Sparkles size={14} /> Modular architecture · Consistent design system
        </div>
      </div>
    </div>
  );
}
