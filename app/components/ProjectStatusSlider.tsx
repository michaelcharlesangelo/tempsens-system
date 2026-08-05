"use client";

import { ProjectStatus, PROJECT_STATUSES } from "@/lib/projects";

// Same 2-way segmented control as PoStatusSlider/ShipmentStatusSlider, for
// a project's own On-going/Finished status.
export default function ProjectStatusSlider({ status, onChange }: { status: ProjectStatus; onChange: (s: ProjectStatus) => void }) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 999, overflow: "hidden" }}>
      {PROJECT_STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          style={{
            border: "none",
            cursor: "pointer",
            padding: "4px 10px",
            whiteSpace: "nowrap",
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            transition: "background 0.15s, color 0.15s",
            background: s.value === status ? s.color : "transparent",
            color: s.value === status ? "white" : "var(--text-muted)",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
