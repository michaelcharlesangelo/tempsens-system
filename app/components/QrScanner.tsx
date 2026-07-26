"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

// NOTE: built against html5-qrcode's documented API but not run live in
// this environment (no network/npm install available here) - worth a
// quick real-device test once deployed, in case the exact method
// signatures need a small tweak for the installed version.
export default function QrScanner({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) {
  const regionId = "qr-scan-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          onScan(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {
          // per-frame "no QR found yet" - expected constantly while aiming, ignore
        }
      )
      .then(() => setCameraStarted(true))
      .catch((e) => setError("Could not start camera: " + (e as Error).message + " - you can still use 'choose from library' below."));

    return () => {
      scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    setError(null);
    try {
      if (cameraStarted) {
        await scannerRef.current.stop().catch(() => {});
        setCameraStarted(false);
      }
      const result = await scannerRef.current.scanFile(file, true);
      onScan(result);
    } catch {
      setError("Couldn't read a QR code from that image - try a clearer photo.");
    }
  }

  return (
    <div className="card">
      <h2>Scan QR code</h2>
      <div id={regionId} style={{ width: "100%", maxWidth: 340, margin: "0 auto" }} />
      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
      <div className="field" style={{ marginTop: 12 }}>
        <label>Or choose from photo library</label>
        <input type="file" accept="image/*" onChange={handleFile} />
      </div>
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={onClose}>Cancel</button>
    </div>
  );
}
