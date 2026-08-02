"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDdMmmYyyy(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${day}-${month}-${d.getFullYear()}`;
}

function parseIso(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Monday-start grid: JS getDay() is 0=Sun..6=Sat, so shift to 0=Mon..6=Sun.
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function buildGrid(viewYear: number, viewMonth: number): Date[] {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const gridStart = new Date(viewYear, viewMonth, 1 - mondayIndex(firstOfMonth));
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
}

export default function DateField({
  value,
  onChange,
  min,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const minDate = min ? parseIso(min) : null;
  const [viewDate, setViewDate] = useState<Date>(selected || (minDate && minDate > new Date() ? minDate : new Date()));
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Popup renders through a portal into document.body with fixed
  // positioning computed here, instead of being position:absolute inside
  // this field's own DOM position - a field inside a horizontally-scrolling
  // table wrapper (overflow-x: auto) implicitly clips overflow-y too per the
  // CSS overflow spec, which was hiding the calendar whenever the table was
  // short (e.g. only one row).
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function reposition() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 4, left: rect.left });
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function openPicker() {
    setViewDate(selected || (minDate && minDate > new Date() ? minDate : new Date()));
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  }

  function isDisabled(d: Date): boolean {
    if (!minDate) return false;
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const mm = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    return dd < mm;
  }

  function pickDay(d: Date) {
    if (isDisabled(d)) return;
    onChange(toIso(d));
    setOpen(false);
  }

  const grid = buildGrid(viewDate.getFullYear(), viewDate.getMonth());
  const today = new Date();

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div onClick={openPicker}>
        <input
          type="text"
          readOnly
          value={value ? formatDdMmmYyyy(value) : ""}
          placeholder={placeholder || "dd-Mmm-yyyy"}
          style={{ cursor: "pointer", background: "white", paddingRight: 30 }}
          onClick={openPicker}
          tabIndex={-1}
        />
        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>

      {open && popupPos && createPortal(
        <div
          ref={popupRef}
          style={{
            position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 1000,
            background: "var(--panel, #fff)", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)", padding: 10, width: 240,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: "0.9rem", padding: "2px 8px" }}
            >
              ‹
            </button>
            <strong style={{ fontSize: "0.82rem" }}>{MONTH_LABELS[viewDate.getMonth()]} {viewDate.getFullYear()}</strong>
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: "0.9rem", padding: "2px 8px" }}
            >
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} style={{ textAlign: "center", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>{w}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {grid.map((d, i) => {
              const inMonth = d.getMonth() === viewDate.getMonth();
              const disabled = isDisabled(d);
              const isSelected = selected && sameDay(d, selected);
              const isToday = sameDay(d, today);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(d)}
                  style={{
                    border: isToday ? "1px solid var(--accent)" : "1px solid transparent",
                    borderRadius: 6,
                    padding: "5px 0",
                    fontSize: "0.78rem",
                    background: isSelected ? "var(--accent)" : "transparent",
                    color: disabled ? "var(--text-muted)" : isSelected ? "white" : inMonth ? "var(--text)" : "var(--text-muted)",
                    opacity: disabled ? 0.4 : inMonth ? 1 : 0.5,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export { formatDdMmmYyyy };
