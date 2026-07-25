"use client";

import { useEffect, useState } from "react";
import NavBar from "@/app/components/NavBar";
import QrImage from "@/app/components/QrImage";
import { StationCode } from "@/lib/jobOrders";

export default function StationsPage() {
  const [stations, setStations] = useState<StationCode[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await fetch("/api/station-codes", { cache: "no-store" }).then((r) => r.json());
    setStations(data.stations ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addStation() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/station-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationName: name, description }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to add station."); return; }
      setName(""); setDescription("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(stationId: string) {
    await fetch(`/api/station-codes/${stationId}/toggle`, { method: "POST" });
    load();
  }

  return (
    <>
      <NavBar active="stations" />
      <div className="card">
        <h2>Register a new station</h2>
        <div className="grid">
          <div className="field"><label>Station name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winding" /></div>
          <div className="field"><label>Description (optional)</label><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" onClick={addStation} disabled={saving || !name.trim()}>{saving ? "Adding..." : "Add station"}</button>
      </div>

      <div className="card" id="print-stations">
        <h2>Stations (print these QR codes for the floor)</h2>
        {stations.length === 0 ? <p className="subtle">None registered yet.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {stations.map((s) => (
              <div key={s.id} style={{ textAlign: "center", border: "1px solid var(--border)", borderRadius: 8, padding: 12, opacity: s.active ? 1 : 0.4 }}>
                <QrImage value={s.code} size={130} />
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: 6 }}>{s.station_name}</div>
                <div className="subtle">{s.description}</div>
                <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px", marginTop: 8 }} onClick={() => toggle(s.id)}>
                  {s.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn secondary" style={{ marginTop: 14 }} onClick={() => window.print()}>Print all QR codes</button>
      </div>
    </>
  );
}
