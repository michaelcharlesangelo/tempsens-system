"use client";

import { PoOutStatus, PO_OUT_STATUSES } from "@/lib/jobOrders";

// 3-way colored segmented control for PO Out status (yellow/blue/green),
// styled like ToggleSwitch's colored track but with 3 fixed stops instead
// of on/off.
export default function PoStatusSlider({ status, onChange }: { status: PoOutStatus; onChange: (s: PoOutStatus) => void }) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 999, overflow: "hidden" }}>
      {PO_OUT_STATUSES.map((s) => (
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
