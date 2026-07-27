"use client";

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      placeholder={placeholder || "Search by date, SO number, or item code..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ marginBottom: 12, maxWidth: 360 }}
    />
  );
}

export function Pager({ page, totalPages, totalCount, onChange }: { page: number; totalPages: number; totalCount: number; onChange: (p: number) => void }) {
  if (totalCount === 0) return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 10 }}>
      <button className="btn secondary" style={{ padding: "4px 10px", fontSize: "0.8rem" }} disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
      <span className="subtle" style={{ fontSize: "0.8rem" }}>Page {page} of {totalPages} ({totalCount})</span>
      <button className="btn secondary" style={{ padding: "4px 10px", fontSize: "0.8rem" }} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next ›</button>
    </div>
  );
}
