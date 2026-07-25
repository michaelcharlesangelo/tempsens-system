"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import QrImage from "@/app/components/QrImage";
import { StationCode, ProductionAccount, SalesPerson, ItemCategory } from "@/lib/jobOrders";

export default function AdminPage() {
  const [stations, setStations] = useState<StationCode[]>([]);
  const [stationName, setStationName] = useState("");
  const [stationDesc, setStationDesc] = useState("");

  const [accounts, setAccounts] = useState<ProductionAccount[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [newSalesName, setNewSalesName] = useState("");

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryTraded, setNewCategoryTraded] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setStations((await (await fetch("/api/station-codes", { cache: "no-store" })).json()).stations ?? []);
    setAccounts((await (await fetch("/api/production-accounts", { cache: "no-store" })).json()).accounts ?? []);
    setSalesPeople((await (await fetch("/api/sales-people", { cache: "no-store" })).json()).salesPeople ?? []);
    setCategories((await (await fetch("/api/item-categories", { cache: "no-store" })).json()).categories ?? []);
  }

  useEffect(() => { load(); }, []);

  async function addStation() {
    const res = await fetch("/api/station-codes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationName, description: stationDesc }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setStationName(""); setStationDesc("");
    load();
  }

  async function toggleStation(id: string) {
    await fetch(`/api/station-codes/${id}/toggle`, { method: "POST" });
    load();
  }

  async function moveStation(id: string, direction: "up" | "down") {
    await fetch(`/api/station-codes/${id}/move`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction }),
    });
    load();
  }

  async function addAccount() {
    const res = await fetch("/api/production-accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, fullName }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setUsername(""); setPassword(""); setFullName("");
    load();
  }

  async function addSalesPerson() {
    const res = await fetch("/api/sales-people", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newSalesName }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setNewSalesName("");
    load();
  }

  async function addCategory() {
    const res = await fetch("/api/item-categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName, isTraded: newCategoryTraded }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setNewCategoryName(""); setNewCategoryTraded(false);
    load();
  }

  return (
    <>
      <TabNav active="/admin" />
      {message && <div className="warn">{message}</div>}

      <div className="card">
        <h2>Register a station</h2>
        <p className="subtle">Order matters — this is the physical process sequence, shown as "step 3 of 10" progress later.</p>
        <div className="grid">
          <div className="field"><label>Station name</label><input type="text" value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder="e.g. Winding" /></div>
          <div className="field"><label>Description</label><input type="text" value={stationDesc} onChange={(e) => setStationDesc(e.target.value)} /></div>
        </div>
        <button className="btn" onClick={addStation} disabled={!stationName.trim()}>Add station</button>
      </div>

      <div className="card">
        <h2>Stations (in process order)</h2>
        {stations.length === 0 ? <p className="subtle">None yet.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
            {stations.map((s, i) => (
              <div key={s.id} style={{ textAlign: "center", border: "1px solid var(--border)", borderRadius: 8, padding: 12, opacity: s.active ? 1 : 0.4 }}>
                <div style={{ fontWeight: 700, fontSize: "0.72rem", color: "var(--accent-dark)" }}>STEP {s.sequence}</div>
                <QrImage value={s.code} size={110} />
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: 4 }}>{s.station_name}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 8 }}>
                  <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => moveStation(s.id, "up")} disabled={i === 0}>↑</button>
                  <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => moveStation(s.id, "down")} disabled={i === stations.length - 1}>↓</button>
                  <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => toggleStation(s.id)}>{s.active ? "Off" : "On"}</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="btn secondary" style={{ marginTop: 14 }} onClick={() => window.print()}>Print all QR codes</button>
      </div>

      <div className="card">
        <h2>Production / QC accounts</h2>
        <p className="subtle">Username + password, no email — used to log into the production scan and QC pages.</p>
        <div className="grid">
          <div className="field"><label>Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="field"><label>Full name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        </div>
        <button className="btn" onClick={addAccount} disabled={!username.trim() || !password.trim() || !fullName.trim()}>Add account</button>
        {accounts.length > 0 && (
          <table className="data-table" style={{ marginTop: 14 }}>
            <thead><tr><th>Username</th><th>Full name</th></tr></thead>
            <tbody>{accounts.map((a) => <tr key={a.id}><td>{a.username}</td><td>{a.full_name}</td></tr>)}</tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Sales people</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" value={newSalesName} onChange={(e) => setNewSalesName(e.target.value)} placeholder="Name" />
          <button className="btn secondary" onClick={addSalesPerson} disabled={!newSalesName.trim()}>Add</button>
        </div>
        {salesPeople.length > 0 && <p className="subtle" style={{ marginTop: 10 }}>{salesPeople.map((p) => p.name).join(", ")}</p>}
      </div>

      <div className="card">
        <h2>Item categories</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category name" />
          <label style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "none", fontSize: "0.85rem" }}>
            <input type="checkbox" checked={newCategoryTraded} onChange={(e) => setNewCategoryTraded(e.target.checked)} style={{ width: "auto" }} />
            Traded (Tempsens India), not manufactured by us
          </label>
          <button className="btn secondary" onClick={addCategory} disabled={!newCategoryName.trim()}>Add</button>
        </div>
        {categories.length > 0 && (
          <p className="subtle" style={{ marginTop: 10 }}>
            {categories.map((c) => `${c.name}${c.is_traded ? " (traded)" : ""}`).join(", ")}
          </p>
        )}
      </div>
    </>
  );
}
