"use client";

import { useState } from "react";
import QrScanner from "@/app/components/QrScanner";
import { JobOrder, StationCode } from "@/lib/jobOrders";

type Step = "scan-jo" | "scan-station" | "form";

// Real per-account production login is queued for later (see CLAUDE.md) -
// until then every scan is just attributed to "Production" as a group.
const SCANNED_BY_LABEL = "Production";

export default function ProductionScanPage() {
  const [step, setStep] = useState<Step>("scan-jo");
  const [scanning, setScanning] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [station, setStation] = useState<StationCode | null>(null);

  const [actualValues, setActualValues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function resetToScanJo() {
    setStep("scan-jo");
    setScanning(false);
    setLookupError(null);
    setJobOrder(null);
    setStation(null);
    setActualValues([]);
    setSuccessMsg(null);
  }

  function startScanStation() {
    setStep("scan-station");
    setLookupError(null);
    setScanning(true);
  }

  async function handleJoScan(code: string) {
    setScanning(false);
    setLookupError(null);
    setLookingUp(true);
    try {
      const res = await fetch(`/api/job-orders?barcode=${encodeURIComponent(code.trim())}`, { cache: "no-store" });
      const data = await res.json();
      const found: JobOrder[] = data.jobOrders ?? [];
      if (found.length === 0) { setLookupError(`No job order found for that QR code.`); return; }
      setJobOrder(found[0]);
      // Chain straight into station scanning - no extra click needed.
      startScanStation();
    } finally {
      setLookingUp(false);
    }
  }

  async function handleStationScan(code: string) {
    setScanning(false);
    setLookupError(null);
    setLookingUp(true);
    try {
      const res = await fetch("/api/station-codes", { cache: "no-store" });
      const data = await res.json();
      const stations: StationCode[] = data.stations ?? [];
      const found = stations.find((s) => s.code.toLowerCase() === code.trim().toLowerCase());
      if (!found) { setLookupError(`No station found for that QR code.`); return; }
      setStation(found);
      setActualValues(found.parameters.map(() => ""));
      setStep("form");
    } finally {
      setLookingUp(false);
    }
  }

  async function submitScan() {
    if (!jobOrder || !station) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const results = station.parameters.map((p, i) => ({ parameter: p, actual: actualValues[i] ?? "" }));
      const res = await fetch("/api/production-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobOrderId: jobOrder.id, stationId: station.id, results }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || "Failed to save."); return; }
      setSuccessMsg(`Saved — ${station.station_name} recorded for ${jobOrder.jo_number}.`);
      startScanStation();
    } finally {
      setSubmitting(false);
    }
  }

  const allFilled = actualValues.length > 0 && actualValues.every((v) => v.trim() !== "");

  return (
    <>
      {successMsg && <div className="card" style={{ color: "var(--good)" }}>{successMsg}</div>}

      {step === "scan-jo" && (
        <div className="card">
          <h2>Scan JO</h2>
          {!scanning ? (
            <button className="btn" onClick={() => { setLookupError(null); setScanning(true); }}>Scan QR</button>
          ) : (
            <QrScanner onScan={handleJoScan} onClose={() => setScanning(false)} />
          )}
          {lookingUp && <p className="subtle" style={{ marginTop: 8 }}>Looking up job order...</p>}
          {lookupError && (
            <div style={{ marginTop: 8 }}>
              <p className="error-text">{lookupError}</p>
              <button className="btn secondary" onClick={() => setScanning(true)}>Try Again</button>
            </div>
          )}
        </div>
      )}

      {step === "scan-station" && jobOrder && (
        <>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <b>{jobOrder.jo_number}</b> — {jobOrder.customer_name}
                <div className="subtle" style={{ fontSize: "0.8rem" }}>{jobOrder.item_no} — {jobOrder.item_description}</div>
              </div>
              <button className="btn secondary" onClick={resetToScanJo}>Change Job Order</button>
            </div>
          </div>
          <div className="card">
            <h2>Scan Station</h2>
            {!scanning ? (
              <button className="btn" onClick={() => { setLookupError(null); setScanning(true); }}>Scan QR</button>
            ) : (
              <QrScanner onScan={handleStationScan} onClose={() => setScanning(false)} />
            )}
            {lookingUp && <p className="subtle" style={{ marginTop: 8 }}>Looking up station...</p>}
            {lookupError && (
              <div style={{ marginTop: 8 }}>
                <p className="error-text">{lookupError}</p>
                <button className="btn secondary" onClick={() => setScanning(true)}>Try Again</button>
              </div>
            )}
          </div>
        </>
      )}

      {step === "form" && jobOrder && station && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div>
              <b>{jobOrder.jo_number}</b> — {jobOrder.customer_name}
              <div className="subtle" style={{ fontSize: "0.8rem" }}>Station: {station.station_name}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn secondary" onClick={startScanStation}>Change Station</button>
              <button className="btn secondary" onClick={resetToScanJo}>Change Job Order</button>
            </div>
          </div>

          {station.parameters.length === 0 ? (
            <p className="subtle">No parameters configured for this station yet - add some under Settings &gt; Production first.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>No.</th><th>Parameter</th><th>Actual</th><th>Checked By</th></tr></thead>
                <tbody>
                  {station.parameters.map((p, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{p}</td>
                      <td>
                        <input
                          type="text"
                          value={actualValues[i] ?? ""}
                          onChange={(e) => setActualValues((cur) => cur.map((v, vi) => (vi === i ? e.target.value : v)))}
                          style={{ width: 140 }}
                        />
                      </td>
                      <td>{SCANNED_BY_LABEL}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {submitError && <p className="error-text" style={{ marginTop: 8 }}>{submitError}</p>}
          <button className="btn" style={{ marginTop: 12 }} disabled={submitting || !allFilled} onClick={submitScan}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </>
  );
}
