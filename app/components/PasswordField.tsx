"use client";

import { useState, CSSProperties } from "react";

export default function PasswordField({
  value, onChange, placeholder, style,
}: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", ...style }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingRight: 32, width: "100%" }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        title={show ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)", display: "flex" }}
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
