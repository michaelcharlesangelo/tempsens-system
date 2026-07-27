"use client";

import { useState } from "react";
import TabNav from "@/app/components/TabNav";
import QrScanner from "@/app/components/QrScanner";
import { JobOrder, StationCode } from "@/lib/jobOrders";

interface Account { id: string; username: string; full_name: string; }

export default function ProductionScanPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [joInput, setJoInput] = useState("");
  const [joError, setJoError] = useState<string | null>(null);
  const [joScanning, setJoScanning] = useState(false);
  const [lookingUpJo, setLookingUpJo] = useState(false);

  const [station, setStation] = useState<StationCode | null>(null);
  const [stationInput, setStationInput] = useState("");
  const [stationError, setStationError] = useState<string | null>(null);
  const [stationScanning, setStationScanning] = useState(false);
  const [lookingUpStation, setLookingUpStation] = useState(false);

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
    setJobOrder(null); setStation(null);
    setJoInput(""); setStationInput(""); setActualValue("");
  }

  async function lookupJo(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoError(null);
    setLookingUpJo(true);
    try {
      const res = await fetch(`/api/job-orders?barcode=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
      const data = await res.json();
      const found: JobOrder[] = data.jobOrders ?? [];
      if (found.length === 0) { setJoError(`No job order found for barcode "${trimmed}".`); return; }
      setJobOrder(found[0]);
      setJoInput("");
    } finally {
      setLookingUpJo(false);
    }
  }

  async function lookupStation(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setStationError(null);
    setLookingUpStation(true);
    try {
      const res = await fetch("/api/station-codes", { cache: "no-store" });
      const data = await res.json();
      const stations: StationCode[] = data.stations ?? [];
      const found = stations.find((s) => s.code.toLowerCase() === trimmed.toLowerCase());
      if (!found) { setStationError(`No station found for code "${trimmed}".`); return; }
      setStation(found);
      setStationInput("");
    } finally {
      setLookingUpStation(false);
    }
  }

  async function submitScan() {
    if (!jobOrder || !station || !account) return;
    setSubmitError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobOrderId: jobOrder.id, stationId: station.id, scannedBy: account.id, actualValue }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || "Failed to save."); return; }
      setSuccessMsg(`Saved — ${station.station_name} recorded for ${jobOrder.jo_number}.`);
      setStation(null);
      setActualValue("");
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
          <div className="field"><label>Password</label><input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} /></div>
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

      {!jobOrder ? (
        <div className="card">
          <h2>1. Scan Job Order</h2>
          <p className="subtle">Scan the JO's QR barcode, or type it in manually.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" placeholder="Barcode" value={joInput} onChange={(e) => setJoInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupJo(joInput)} style={{ maxWidth: 220 }} />
            <button className="btn secondary" disabled={lookingUpJo || !joInput.trim()} onClick={() => lookupJo(joInput)}>{lookingUpJo ? "Looking up..." : "Look Up"}</button>
            <button className="btn secondary" onClick={() => setJoScanning((s) => !s)}>{joScanning ? "Cancel Scan" : "Scan with Camera"}</button>
          </div>
          {joError && <p className="error-text" style={{ marginTop: 8 }}>{joError}</p>}
          {joScanning && (
            <div style={{ marginTop: 12 }}>
              <QrScanner onScan={(v) => { setJoScanning(false); lookupJo(v); }} onClose={() => setJoScanning(false)} />
            </div>
          )}
        </div>
      ) : !station ? (
        <>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <b>{jobOrder.jo_number}</b> — {jobOrder.customer_name}
                <div className="subtle" style={{ fontSize: "0.8rem" }}>{jobOrder.item_no} — {jobOrder.item_description}</div>
              </div>
              <button className="btn secondary" onClick={() => setJobOrder(null)}>Change Job Order</button>
            </div>
          </div>
          <div className="card">
            <h2>2. Scan Station</h2>
            <p className="subtle">Scan the station's QR code, or type it in manually.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input type="text" placeholder="Station code" value={stationInput} onChange={(e) => setStationInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupStation(stationInput)} style={{ maxWidth: 220 }} />
              <button className="btn secondary" disabled={lookingUpStation || !stationInput.trim()} onClick={() => lookupStation(stationInput)}>{lookingUpStation ? "Looking up..." : "Look Up"}</button>
              <button className="btn secondary" onClick={() => setStationScanning((s) => !s)}>{stationScanning ? "Cancel Scan" : "Scan with Camera"}</button>
            </div>
            {stationError && <p className="error-text" style={{ marginTop: 8 }}>{stationError}</p>}
            {stationScanning && (
              <div style={{ marginTop: 12 }}>
                <QrScanner onScan={(v) => { setStationScanning(false); lookupStation(v); }} onClose={() => setStationScanning(false)} />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div>
              <b>{jobOrder.jo_number}</b> — {jobOrder.customer_name}
              <div className="subtle" style={{ fontSize: "0.8rem" }}>Station: {station.station_name}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn secondary" onClick={() => setStation(null)}>Change Station</button>
              <button className="btn secondary" onClick={() => setJobOrder(null)}>Change Job Order</button>
            </div>
          </div>

          <div className="form-row"><label>Parameter</label><span>:</span><span>{station.parameter || "-"}</span></div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Actual</label>
            <input type="text" value={actualValue} onChange={(e) => setActualValue(e.target.value)} placeholder="e.g. 180degC for 50min" />
          </div>
          <div className="form-row"><label>Performed By</label><span>:</span><span>{account.full_name}</span></div>

          {submitError && <p className="error-text" style={{ marginTop: 8 }}>{submitError}</p>}
          {successMsg && <p style={{ color: "var(--good)", fontSize: "0.85rem", marginTop: 8 }}>{successMsg}</p>}
          <button className="btn" style={{ marginTop: 12 }} disabled={submitting || !actualValue.trim()} onClick={submitScan}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </>
  );
}
