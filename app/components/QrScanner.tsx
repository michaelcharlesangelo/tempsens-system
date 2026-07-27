"use client";

import { useEffect, useRef } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

export default function QrScanner({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) {
  // Unique per mount - a fixed id caused trouble when this component
  // mounted more than once in a session (JO scan, then station scan):
  // the previous instance's leftover DOM/video state could collide with
  // the new one targeting the same element id.
  const regionIdRef = useRef(`qr-scan-region-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    // Html5QrcodeScanner (vs. the lower-level Html5Qrcode) owns its own
    // camera enumeration/permission UI, which is far more robust across
    // desktop webcams and phones than hand-rolling facingMode fallbacks.
    const scanner = new Html5QrcodeScanner(
      regionIdRef.current,
      {
        fps: 10,
        qrbox: 250,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA, Html5QrcodeScanType.SCAN_TYPE_FILE],
      },
      false
    );

    function onDecode(decodedText: string) {
      if (cancelled) return;
      onScan(decodedText);
      scanner.clear().catch(() => {});
    }

    scanner.render(onDecode, () => {});

    return () => {
      cancelled = true;
      scanner.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <h2>Scan QR code</h2>
      <div id={regionIdRef.current} style={{ width: "100%", maxWidth: 340, margin: "0 auto" }} />
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={onClose}>Cancel</button>
    </div>
  );
}
