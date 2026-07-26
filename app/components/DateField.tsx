"use client";

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
  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        readOnly
        value={value ? formatDdMmmYyyy(value) : ""}
        placeholder={placeholder || "dd-Mmm-yyyy"}
        style={{ cursor: "pointer", background: "white" }}
      />
      <input
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
