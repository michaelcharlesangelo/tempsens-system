"use client";

// Long free-text values (item descriptions etc.) in a table cell get
// clipped with an ellipsis instead of stretching the row - hover (native
// title tooltip) shows the full text.
export default function TruncatedText({ text, maxWidth = 240 }: { text: string; maxWidth?: number }) {
  return (
    <span
      title={text}
      style={{ display: "inline-block", maxWidth, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}
    >
      {text}
    </span>
  );
}
