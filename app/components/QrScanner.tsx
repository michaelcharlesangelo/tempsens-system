"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QrScanner({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) {
  // Unique per mount - a fixed id caused trouble when this component
  // mounted more than once in a session (JO scan, then station scan):
  // the previous instance's leftover DOM/video state could collide with
  // the new one targeting the same element id.
  const regionIdRef = useRef(`qr-scan-region-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(regionIdRef.current);
    scannerRef.current = scanner;

    function onDecode(decodedText: string) {
      if (cancelled) return;
      onScan(decodedText);
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    }

    async function start() {
      const config = { fps: 10, qrbox: 250 };
      // facingMode: "environment" only exists on phones with a rear
      // camera - desktop webcams reject that constraint outright, which
      // is likely why scanning silently did nothing on a laptop. Fall
      // back to enumerating actual cameras and using whichever is found.
      try {
        await scanner.start({ facingMode: "environment" }, config, onDecode, () => {});
      } catch {
        if (cancelled) return;
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cancelled) return;
          if (!cameras || cameras.length === 0) throw new Error("No camera was found on this device.");
          await scanner.start(cameras[0].id, config, onDecode, () => {});
        } catch (e2) {
          if (!cancelled) setError("Could not start camera: " + (e2 as Error).message + " - you can still use 'choose from library' below.");
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }
    start();

    return () => {
      cancelled = true;
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    setError(null);
    try {
      await scannerRef.current.stop().catch(() => {});
      const result = await scannerRef.current.scanFile(file, true);
      onScan(result);
    } catch {
      setError("Couldn't read a QR code from that image - try a clearer photo.");
    }
  }

  return (
    <div className="card">
      <h2>Scan QR code</h2>
      {starting && !error && <p className="subtle">Requesting camera access...</p>}
      <div id={regionIdRef.current} style={{ width: "100%", maxWidth: 340, margin: "0 auto" }} />
      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
      <div className="field" style={{ marginTop: 12 }}>
        <label>Or choose from photo library</label>
        <input type="file" accept="image/*" onChange={handleFile} />
      </div>
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={onClose}>Cancel</button>
    </div>
  );
}
