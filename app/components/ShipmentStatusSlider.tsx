"use client";

import { ShipmentStatus, SHIPMENT_STATUSES } from "@/lib/jobOrders";

// Same 3-way segmented control as PoStatusSlider, one level up: Plan ->
// Shipment -> Arrived for the shipment itself rather than a single PO Out
// row.
export default function ShipmentStatusSlider({ status, onChange }: { status: ShipmentStatus; onChange: (s: ShipmentStatus) => void }) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 999, overflow: "hidden" }}>
      {SHIPMENT_STATUSES.map((s) => (
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
