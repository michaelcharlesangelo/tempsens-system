"use client";

import { ReactNode, useState } from "react";

// Shared card wrapper for list-table sections across the workflow tabs -
// starts collapsed so a page with several tables isn't overwhelming; the
// header (with live count) stays visible either way so nothing needs to
// be open to know what's there. `actions` renders next to the header,
// outside the collapsed/expanded body, for things like a per-section
// button that should stay reachable regardless of open state.
export default function Collapsible({
  title, count, actions, defaultOpen = false, children,
}: {
  title: string; count?: number; actions?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2
          style={{ margin: 0, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }}
          onClick={() => setOpen((v) => !v)}
        >
          <span style={{ display: "inline-block", fontSize: "0.75em", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
          {title}{count !== undefined && ` (${count})`}
        </h2>
        {actions}
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}
