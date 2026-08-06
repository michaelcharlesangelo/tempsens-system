"use client";

import { useState } from "react";

// Long free-text values (item descriptions etc.) in a table cell get
// clipped with an ellipsis instead of stretching the row - click toggles
// between clipped and full (wrapping) text. Previously this was a hover
// (native title) tooltip, which has no equivalent on a touch device.
export default function TruncatedText({ text, maxWidth = 240 }: { text: string; maxWidth?: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <span
      onClick={() => setExpanded((v) => !v)}
      style={
        expanded
          ? { display: "inline-block", maxWidth, whiteSpace: "normal", wordBreak: "break-word", cursor: "pointer" }
          : { display: "inline-block", maxWidth, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom", cursor: "pointer" }
      }
    >
      {text}
    </span>
  );
}
