"use client";

import { ComplaintStatus, COMPLAINT_STATUSES } from "@/lib/jobOrders";

// Same 3-stop colored segmented control as PoStatusSlider, for Engineering's
// Not Done / In Progress / Done complaint status.
export default function ComplaintStatusSlider({ status, onChange }: { status: ComplaintStatus; onChange: (s: ComplaintStatus) => void }) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 999, overflow: "hidden" }}>
      {COMPLAINT_STATUSES.map((s) => (
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
