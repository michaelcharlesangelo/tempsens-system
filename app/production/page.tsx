"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import QrScanner from "@/app/components/QrScanner";
import { JobOrder, StationCode } from "@/lib/jobOrders";

type Step = "scan-jo" | "scan-station" | "form";

// Real per-account production login is queued for later (see CLAUDE.md) -
// until then every scan is just attributed to "Production" as a group.
const SCANNED_BY_LABEL = "Production";

export default function ProductionScanPage() {
  return (
    <Suspense fallback={<p className="subtle">Loading...</p>}>
      <ProductionScanInner />
    </Suspense>
  );
}

function ProductionScanInner() {
  // The JO's printed/on-screen QR encodes a link to /production?jo=<code>
  // so any camera app - not just this page's own in-app scanner, which
  // has proven unreliable at actually decoding frames - can open it
  // directly and land here ready to look the JO up, no in-app scan step
  // needed for this leg at all.
  const searchParams = useSearchParams();
  const joParam = searchParams.get("jo");
  const [step, setStep] = useState<Step>("scan-jo");
  const [scanning, setScanning] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [station, setStation] = useState<StationCode | null>(null);

  // Outer index = unit (0-based, matches jobOrder.serial_numbers), inner
  // index = parameter - a JO with qty > 1 needs its own reading per unit,
  // not one shared set for the whole batch.
  const [actualValues, setActualValues] = useState<string[][]>([]);
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const VISIBLE_UNITS = 3;

  function resetToScanJo() {
    setStep("scan-jo");
    setScanning(false);
    setLookupError(null);
    setJobOrder(null);
    setStation(null);
    setActualValues([]);
    setShowAllUnits(false);
    setSuccessMsg(null);
  }

  function startScanStation() {
    setStep("scan-station");
    setLookupError(null);
    setScanning(true);
  }

  // The in-app scanner hands back whatever the QR actually contains - if
  // it decoded the /production?jo=<code> link itself (rather than the
  // browser having already navigated there), pull the code back out of
  // it. Falls through unchanged for a bare code (the station QR was never
  // a link).
  function extractJoCode(scanned: string): string {
    try {
      const url = new URL(scanned);
      return url.searchParams.get("jo") || scanned;
    } catch {
      return scanned;
    }
  }

  async function handleJoScan(scanned: string) {
    const code = extractJoCode(scanned);
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

  useEffect(() => {
    if (joParam) handleJoScan(joParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joParam]);

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
      const qty = Math.max(1, jobOrder?.quantity ?? 1);
      setActualValues(Array.from({ length: qty }, () => found.parameters.map(() => "")));
      setShowAllUnits(false);
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
      const results = actualValues.flatMap((unitValues, unit) =>
        station.parameters.map((p, pi) => ({ parameter: p, actual: unitValues[pi] ?? "", unit }))
      );
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

  const allFilled = actualValues.length > 0 && actualValues.every((unitValues) => unitValues.every((v) => v.trim() !== ""));

  function unitLabel(unitIndex: number): string {
    const serial = jobOrder?.serial_numbers?.[unitIndex];
    return serial || `Unit ${unitIndex + 1}`;
  }

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
            <>
              {actualValues.slice(0, showAllUnits ? actualValues.length : VISIBLE_UNITS).map((unitValues, unit) => (
                <div key={unit} style={{ marginBottom: 16 }}>
                  {actualValues.length > 1 && <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 6 }}>{unitLabel(unit)}</div>}
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>No.</th><th>Parameter</th><th>Actual</th><th>Checked By</th></tr></thead>
                      <tbody>
                        {station.parameters.map((p, pi) => (
                          <tr key={pi}>
                            <td>{pi + 1}</td>
                            <td>{p}</td>
                            <td>
                              <input
                                type="text"
                                value={unitValues[pi] ?? ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setActualValues((cur) => cur.map((uv, ui) => (ui === unit ? uv.map((v, vi) => (vi === pi ? value : v)) : uv)));
                                }}
                                style={{ width: 140 }}
                              />
                            </td>
                            <td>{SCANNED_BY_LABEL}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {actualValues.length > VISIBLE_UNITS && (
                <button className="btn secondary" style={{ marginBottom: 12 }} onClick={() => setShowAllUnits((v) => !v)}>
                  {showAllUnits ? "Hide" : `Show remaining ${actualValues.length - VISIBLE_UNITS} unit${actualValues.length - VISIBLE_UNITS > 1 ? "s" : ""}`}
                </button>
              )}
            </>
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
