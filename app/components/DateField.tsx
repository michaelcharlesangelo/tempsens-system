"use client";

import { useRef } from "react";

function formatDdMmmYyyy(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${day}-${month}-${d.getFullYear()}`;
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
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = dateInputRef.current;
    if (!el) return;
    // showPicker() reliably forces the native calendar open on click.
    // Relying only on the invisible overlay input catching the click is
    // flaky across browsers, which is what made the field feel "unclickable".
    if (typeof (el as any).showPicker === "function") {
      try {
        (el as any).showPicker();
        return;
      } catch {
        // fall through to focus/click below
      }
    }
    el.focus();
    el.click();
  }

  return (
    <div style={{ position: "relative" }} onClick={openPicker}>
      <input
        type="text"
        readOnly
        value={value ? formatDdMmmYyyy(value) : ""}
        placeholder={placeholder || "dd-Mmm-yyyy"}
        style={{ cursor: "pointer", background: "white" }}
        onClick={openPicker}
        tabIndex={-1}
      />
      <input
        ref={dateInputRef}
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}
      />
    </div>
  );
}

export { formatDdMmmYyyy };
