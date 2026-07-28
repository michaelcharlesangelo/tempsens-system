"use client";

// Slide toggle: left/off shows a plain X, right/on shows a check on the
// accent (Tempsens orange) track - used for the approval-table filters.
export default function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 38, height: 21, borderRadius: 999, position: "relative", flex: "none",
          background: checked ? "var(--accent)" : "var(--panel-muted)",
          border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute", top: 1, left: checked ? 18 : 1, width: 17, height: 17, borderRadius: "50%",
            background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.25)", transition: "left 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {checked ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>
          )}
        </span>
      </span>
      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: checked ? "var(--text)" : "var(--text-muted)" }}>{label}</span>
    </label>
  );
}
