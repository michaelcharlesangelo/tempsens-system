"use client";

import { useState } from "react";
import TabNav from "@/app/components/TabNav";
import QrScanner from "@/app/components/QrScanner";
import PasswordField from "@/app/components/PasswordField";
import { JobOrder, StationCode } from "@/lib/jobOrders";

interface Account { id: string; username: string; full_name: string; }
type Step = "scan-jo" | "scan-station" | "form";

export default function ProductionScanPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [step, setStep] = useState<Step>("scan-jo");
  const [scanning, setScanning] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [station, setStation] = useState<StationCode | null>(null);

  const [actualValue, setActualValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function login() {
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch("/api/production/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Login failed."); return; }
      setAccount(data.account);
      setLoginUsername(""); setLoginPassword("");
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    setAccount(null);
    resetToScanJo();
  }

  function resetToScanJo() {
    setStep("scan-jo");
    setScanning(false);
    setLookupError(null);
    setJobOrder(null);
    setStation(null);
    setActualValue("");
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
      setStep("form");
    } finally {
      setLookingUp(false);
    }
  }

  async function submitScan() {
    if (!jobOrder || !station || !account) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobOrderId: jobOrder.id, stationId: station.id, scannedBy: account.id, actualValue }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || "Failed to save."); return; }
      setSuccessMsg(`Saved — ${station.station_name} recorded for ${jobOrder.jo_number}.`);
      setActualValue("");
      startScanStation();
    } finally {
      setSubmitting(false);
    }
  }

  if (!account) {
    return (
      <>
        <TabNav active="/production" />
        <div className="card" style={{ maxWidth: 400 }}>
          <h2>Production Login</h2>
          <div className="field"><label>Username</label><input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} /></div>
          <div className="field"><label>Password</label><PasswordField value={loginPassword} onChange={setLoginPassword} /></div>
          {loginError && <p className="error-text">{loginError}</p>}
          <button className="btn" onClick={login} disabled={loggingIn || !loginUsername.trim() || !loginPassword.trim()}>{loggingIn ? "Logging in..." : "Log In"}</button>
        </div>
      </>
    );
  }

  return (
    <>
      <TabNav active="/production" />
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>Logged in as <b>{account.full_name}</b></div>
          <button className="btn secondary" onClick={logout}>Log Out</button>
        </div>
      </div>

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

          <div className="form-row"><label>Parameter</label><span>:</span><span>{station.parameter || "-"}</span></div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Actual</label>
            <input type="text" value={actualValue} onChange={(e) => setActualValue(e.target.value)} placeholder="e.g. 180degC for 50min" />
          </div>
          <div className="form-row"><label>Performed By</label><span>:</span><span>{account.full_name}</span></div>

          {submitError && <p className="error-text" style={{ marginTop: 8 }}>{submitError}</p>}
          <button className="btn" style={{ marginTop: 12 }} disabled={submitting || !actualValue.trim()} onClick={submitScan}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </>
  );
}
