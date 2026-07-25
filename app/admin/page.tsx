"use client";

import { Fragment, useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import QrImage from "@/app/components/QrImage";
import { StationCode, ProductionAccount, SalesPerson, ItemCategory, BomTemplate } from "@/lib/jobOrders";

type AdminTab = "production" | "sales" | "product";

export default function AdminPage() {
  const [adminTab, setAdminTab] = useState<AdminTab>("production");
  const [message, setMessage] = useState<string | null>(null);

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
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [templates, setTemplates] = useState<BomTemplate[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  async function load() {
    setStations((await (await fetch("/api/station-codes", { cache: "no-store" })).json()).stations ?? []);
    setAccounts((await (await fetch("/api/production-accounts", { cache: "no-store" })).json()).accounts ?? []);
    setSalesPeople((await (await fetch("/api/sales-people", { cache: "no-store" })).json()).salesPeople ?? []);
    setCategories((await (await fetch("/api/item-categories", { cache: "no-store" })).json()).categories ?? []);
    setTemplates((await (await fetch("/api/bom-templates", { cache: "no-store" })).json()).templates ?? []);
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

  async function moveCategory(id: string, direction: "up" | "down") {
    await fetch(`/api/item-categories/${id}/move`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction }),
    });
    load();
  }

  function startEditCategory(c: ItemCategory) {
    setEditingCategoryId(c.id);
    setEditingCategoryName(c.name);
  }

  async function saveEditCategory(id: string) {
    await fetch(`/api/item-categories/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingCategoryName }),
    });
    setEditingCategoryId(null);
    load();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category?")) return;
    await fetch(`/api/item-categories/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <TabNav active="/admin" />
      {message && <div className="warn">{message}</div>}

      <div className="pill-toggle" style={{ marginBottom: 16, display: "inline-flex" }}>
        <button className={adminTab === "production" ? "active" : ""} onClick={() => setAdminTab("production")}>Production</button>
        <button className={adminTab === "sales" ? "active" : ""} onClick={() => setAdminTab("sales")}>Sales</button>
        <button className={adminTab === "product" ? "active" : ""} onClick={() => setAdminTab("product")}>Product</button>
      </div>

      {adminTab === "production" && (
        <>
          <div className="card">
            <h2>Register a station</h2>
            <p className="subtle">Order matters — this is the physical process sequence.</p>
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
            <p className="subtle">Username + password, no email.</p>
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
        </>
      )}

      {adminTab === "sales" && (
        <div className="card">
          <h2>Sales people</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={newSalesName} onChange={(e) => setNewSalesName(e.target.value)} placeholder="Name" />
            <button className="btn secondary" onClick={addSalesPerson} disabled={!newSalesName.trim()}>Add</button>
          </div>
          {salesPeople.length > 0 && (
            <table className="data-table" style={{ marginTop: 14 }}>
              <thead><tr><th>Name</th></tr></thead>
              <tbody>{salesPeople.map((p) => <tr key={p.id}><td>{p.name}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}

      {adminTab === "product" && (
        <>
          <div className="card">
            <h2>Item categories</h2>
            <p className="subtle">Order here also controls the dropdown order on the JO Input page.</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" />
              <label style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "none", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={newCategoryTraded} onChange={(e) => setNewCategoryTraded(e.target.checked)} style={{ width: "auto" }} />
                Traded (Tempsens India)
              </label>
              <button className="btn secondary" onClick={addCategory} disabled={!newCategoryName.trim()}>Add</button>
            </div>

            {categories.length === 0 ? <p className="subtle">None yet.</p> : (
              <table className="data-table">
                <thead><tr><th>#</th><th>Name</th><th>Type</th><th></th></tr></thead>
                <tbody>
                  {categories.map((c, i) => (
                    <tr key={c.id}>
                      <td>{c.sequence}</td>
                      <td>
                        {editingCategoryId === c.id ? (
                          <input type="text" value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} style={{ maxWidth: 200 }} />
                        ) : (
                          c.name
                        )}
                      </td>
                      <td>{c.is_traded ? "Traded" : "Manufactured"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => moveCategory(c.id, "up")} disabled={i === 0}>↑</button>{" "}
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => moveCategory(c.id, "down")} disabled={i === categories.length - 1}>↓</button>{" "}
                        {editingCategoryId === c.id ? (
                          <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => saveEditCategory(c.id)}>Save</button>
                        ) : (
                          <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => startEditCategory(c)}>Rename</button>
                        )}{" "}
                        <button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteCategory(c.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>Saved BOM templates</h2>
            <p className="subtle">Auto-saved whenever a job order is completed - lets Production Manager recall the BOM used last time on a repeat order.</p>
            {templates.length === 0 ? <p className="subtle">None saved yet.</p> : (
              <table className="data-table">
                <thead><tr><th>Item No.</th><th>Description</th><th>Last used (JO)</th><th>Saved</th><th></th></tr></thead>
                <tbody>
                  {templates.map((t) => (
                    <Fragment key={t.item_no}>
                      <tr>
                        <td>{t.item_no}</td>
                        <td>{t.description}</td>
                        <td>{t.source_jo_number}</td>
                        <td>{new Date(t.saved_at).toLocaleDateString()}</td>
                        <td>
                          <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setExpandedTemplate(expandedTemplate === t.item_no ? null : t.item_no)}>
                            {expandedTemplate === t.item_no ? "Hide" : "View BOM"}
                          </button>
                        </td>
                      </tr>
                      {expandedTemplate === t.item_no && (
                        <tr>
                          <td colSpan={5} style={{ background: "var(--panel-muted)" }}>
                            {t.bom_snapshot.map((r, i) => (
                              <div key={i} style={{ fontSize: "0.82rem", padding: "3px 0" }}>{r.itemNo} — {r.description} — {r.qty} {r.unit}</div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
