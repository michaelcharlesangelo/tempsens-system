"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import QrImage from "@/app/components/QrImage";
import PasswordField from "@/app/components/PasswordField";
import { StationCode, ProductionAccount, SalesPerson, BackOfficePerson, ItemCategory, Position } from "@/lib/jobOrders";

type AdminTab = "production" | "account" | "product" | "items";

interface CatalogItem { item_no: string; description: string; category: string | null; unit: string; }

export default function AdminPage() {
  const [adminTab, setAdminTab] = useState<AdminTab>("production");
  const [message, setMessage] = useState<string | null>(null);

  const [stations, setStations] = useState<StationCode[]>([]);
  const [stationName, setStationName] = useState("");
  const [stationDesc, setStationDesc] = useState("");
  const [editingStationParamId, setEditingStationParamId] = useState<string | null>(null);
  const [stationParamDraft, setStationParamDraft] = useState("");

  const [accounts, setAccounts] = useState<ProductionAccount[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [newAccountPositionId, setNewAccountPositionId] = useState("");
  const [accountPasswordDraft, setAccountPasswordDraft] = useState<Record<string, string>>({});

  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [newSalesName, setNewSalesName] = useState("");
  const [newSalesEmail, setNewSalesEmail] = useState("");
  const [newSalesPassword, setNewSalesPassword] = useState("");
  const [newSalesPositionId, setNewSalesPositionId] = useState("");
  const [salesPasswordDraft, setSalesPasswordDraft] = useState<Record<string, string>>({});

  const [backOffice, setBackOffice] = useState<BackOfficePerson[]>([]);
  const [newBoName, setNewBoName] = useState("");
  const [newBoEmail, setNewBoEmail] = useState("");
  const [newBoPassword, setNewBoPassword] = useState("");
  const [newBoPositionId, setNewBoPositionId] = useState("");
  const [boPasswordDraft, setBoPasswordDraft] = useState<Record<string, string>>({});

  const [positions, setPositions] = useState<Position[]>([]);
  const [newPositionName, setNewPositionName] = useState("");

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [editingItemNo, setEditingItemNo] = useState<string | null>(null);
  const [editingItemDesc, setEditingItemDesc] = useState("");
  const [editingItemUnit, setEditingItemUnit] = useState("");

  async function loadStations() {
    setStations((await (await fetch("/api/station-codes", { cache: "no-store" })).json()).stations ?? []);
  }
  async function loadAccounts() {
    setAccounts((await (await fetch("/api/production-accounts", { cache: "no-store" })).json()).accounts ?? []);
  }
  async function loadSales() {
    setSalesPeople((await (await fetch("/api/sales-people", { cache: "no-store" })).json()).salesPeople ?? []);
  }
  async function loadPositions() {
    setPositions((await (await fetch("/api/positions", { cache: "no-store" })).json()).positions ?? []);
  }
  async function loadBackOffice() {
    setBackOffice((await (await fetch("/api/back-office", { cache: "no-store" })).json()).people ?? []);
  }
  async function loadCategories() {
    setCategories((await (await fetch("/api/item-categories", { cache: "no-store" })).json()).categories ?? []);
  }
  async function loadCatalog() {
    setCatalogItems((await (await fetch("/api/item-catalog?kind=material", { cache: "no-store" })).json()).items ?? []);
  }

  useEffect(() => {
    loadStations(); loadAccounts(); loadSales(); loadCategories(); loadCatalog(); loadPositions(); loadBackOffice();
  }, []);

  async function addStation() {
    const res = await fetch("/api/station-codes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationName, description: stationDesc }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setStationName(""); setStationDesc("");
    loadStations();
  }

  async function saveStationParameter(id: string) {
    await fetch(`/api/station-codes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parameter: stationParamDraft }),
    });
    setEditingStationParamId(null);
    loadStations();
  }

  async function toggleStation(id: string) {
    await fetch(`/api/station-codes/${id}/toggle`, { method: "POST" });
    loadStations();
  }

  async function moveStation(id: string, direction: "up" | "down") {
    await fetch(`/api/station-codes/${id}/move`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction }),
    });
    loadStations();
  }

  async function addAccount() {
    const res = await fetch("/api/production-accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, fullName, positionId: newAccountPositionId || null }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setUsername(""); setPassword(""); setFullName(""); setNewAccountPositionId("");
    loadAccounts();
  }

  async function setAccountPosition(id: string, positionId: string) {
    await fetch(`/api/production-accounts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ positionId: positionId || null }),
    });
    loadAccounts();
  }

  async function saveAccountPassword(id: string) {
    const pw = accountPasswordDraft[id];
    if (!pw) return;
    await fetch(`/api/production-accounts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    setAccountPasswordDraft((d) => ({ ...d, [id]: "" }));
    setMessage("Password updated.");
  }

  async function deleteAccount(id: string) {
    if (!confirm("Delete this Production/QC account? This can't be undone.")) return;
    await fetch(`/api/production-accounts/${id}`, { method: "DELETE" });
    loadAccounts();
  }

  async function addSalesPerson() {
    const res = await fetch("/api/sales-people", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSalesName, email: newSalesEmail, password: newSalesPassword, positionId: newSalesPositionId || null }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setNewSalesName(""); setNewSalesEmail(""); setNewSalesPassword(""); setNewSalesPositionId("");
    loadSales();
  }

  async function setSalesPosition(id: string, positionId: string) {
    await fetch(`/api/sales-people/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ positionId: positionId || null }),
    });
    loadSales();
  }

  async function deleteSalesPerson(id: string) {
    if (!confirm("Delete this Sales Person? This can't be undone.")) return;
    await fetch(`/api/sales-people/${id}`, { method: "DELETE" });
    loadSales();
  }

  async function addPosition() {
    const res = await fetch("/api/positions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPositionName }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setNewPositionName("");
    loadPositions();
  }

  async function deletePosition(id: string) {
    if (!confirm("Delete this position type? People currently assigned to it will show as unassigned.")) return;
    await fetch(`/api/positions/${id}`, { method: "DELETE" });
    loadPositions();
    loadAccounts();
    loadSales();
    loadBackOffice();
  }

  async function addBackOffice() {
    const res = await fetch("/api/back-office", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBoName, email: newBoEmail, password: newBoPassword, positionId: newBoPositionId || null }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setNewBoName(""); setNewBoEmail(""); setNewBoPassword(""); setNewBoPositionId("");
    loadBackOffice();
  }

  async function setBackOfficePosition(id: string, positionId: string) {
    await fetch(`/api/back-office/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ positionId: positionId || null }),
    });
    loadBackOffice();
  }

  async function saveBackOfficePassword(id: string) {
    const pw = boPasswordDraft[id];
    if (!pw) return;
    await fetch(`/api/back-office/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    setBoPasswordDraft((d) => ({ ...d, [id]: "" }));
    setMessage("Password updated.");
  }

  async function deleteBackOffice(id: string) {
    if (!confirm("Delete this Back Office person? This can't be undone.")) return;
    await fetch(`/api/back-office/${id}`, { method: "DELETE" });
    loadBackOffice();
  }

  async function saveSalesPassword(id: string) {
    const pw = salesPasswordDraft[id];
    if (!pw) return;
    await fetch(`/api/sales-people/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    setSalesPasswordDraft((d) => ({ ...d, [id]: "" }));
    setMessage("Password updated.");
  }

  async function addCategory() {
    const res = await fetch("/api/item-categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setNewCategoryName("");
    loadCategories();
  }

  async function moveCategory(id: string, direction: "up" | "down") {
    const idx = categories.findIndex((c) => c.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= categories.length) return;
    const optimistic = [...categories];
    [optimistic[idx], optimistic[swapIdx]] = [optimistic[swapIdx], optimistic[idx]];
    setCategories(optimistic);
    await fetch(`/api/item-categories/${id}/move`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction }),
    });
    loadCategories();
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
    loadCategories();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category?")) return;
    await fetch(`/api/item-categories/${id}`, { method: "DELETE" });
    loadCategories();
  }

  async function saveCatalogItem(itemNo: string) {
    await fetch("/api/item-catalog", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemNo, description: editingItemDesc, unit: editingItemUnit }),
    });
    setEditingItemNo(null);
    loadCatalog();
  }

  async function deleteCatalogItem(itemNo: string) {
    if (!confirm(`Delete material item "${itemNo}"?`)) return;
    await fetch(`/api/item-catalog?itemNo=${encodeURIComponent(itemNo)}`, { method: "DELETE" });
    loadCatalog();
  }

  return (
    <>
      <TabNav active="/admin" />
      {message && <div className="warn">{message}</div>}

      <div className="pill-toggle equal-width" style={{ marginBottom: 16 }}>
        <button className={adminTab === "production" ? "active" : ""} onClick={() => setAdminTab("production")}>Production</button>
        <button className={adminTab === "account" ? "active" : ""} onClick={() => setAdminTab("account")}>Account</button>
        <button className={adminTab === "product" ? "active" : ""} onClick={() => setAdminTab("product")}>Product</button>
        <button className={adminTab === "items" ? "active" : ""} onClick={() => setAdminTab("items")}>Items</button>
      </div>

      {adminTab === "production" && (
        <>
          <div className="card">
            <h2>Register a station</h2>
            <p className="subtle">Order matters — this is the physical process sequence.</p>
            <div className="grid">
              <div className="field"><label>Station name</label><input type="text" value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder="e.g. Drying" /></div>
              <div className="field"><label>Description</label><input type="text" value={stationDesc} onChange={(e) => setStationDesc(e.target.value)} placeholder="e.g. Oven Drying 200degC" /></div>
            </div>
            <button className="btn" onClick={addStation} disabled={!stationName.trim()}>Add station</button>
          </div>

          <div className="card">
            <h2>Stations (in process order)</h2>
            {stations.length === 0 ? <p className="subtle">None yet.</p> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                {stations.map((s, i) => (
                  <div key={s.id} style={{ textAlign: "center", border: "1px solid var(--border)", borderRadius: 8, padding: 12, opacity: s.active ? 1 : 0.4 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.72rem", color: "var(--accent-dark)" }}>STEP {s.sequence}</div>
                    <QrImage value={s.code} size={110} />
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: 4 }}>{s.station_name}</div>
                    {editingStationParamId === s.id ? (
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <input type="text" value={stationParamDraft} onChange={(e) => setStationParamDraft(e.target.value)} placeholder="e.g. 200degC for 60min" style={{ fontSize: "0.75rem" }} />
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.72rem" }} onClick={() => saveStationParameter(s.id)}>Save</button>
                      </div>
                    ) : (
                      <div className="subtle" style={{ fontSize: "0.72rem", marginTop: 2, cursor: "pointer" }} onClick={() => { setEditingStationParamId(s.id); setStationParamDraft(s.parameter || ""); }}>
                        {s.parameter || "Set parameter..."}
                      </div>
                    )}
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
        </>
      )}

      {adminTab === "account" && (
        <>
          <div className="card">
            <h2>Position types</h2>
            <p className="subtle">Extensible list of roles assignable to people below. Add new ones as needed.</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <input type="text" value={newPositionName} onChange={(e) => setNewPositionName(e.target.value)} placeholder="New position name" />
              <button className="btn secondary" onClick={addPosition} disabled={!newPositionName.trim()}>Add</button>
            </div>
            {positions.length === 0 ? <p className="subtle">None yet.</p> : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {positions.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: "0.82rem" }}>
                    {p.name}
                    <button className="btn danger" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: 999 }} onClick={() => deletePosition(p.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Production / QC accounts</h2>
            <p className="subtle">Username + password, no email.</p>
            <div className="grid">
              <div className="field"><label>Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
              <div className="field"><label>Password</label><PasswordField value={password} onChange={setPassword} /></div>
              <div className="field"><label>Full name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="field">
                <label>Position</label>
                <select value={newAccountPositionId} onChange={(e) => setNewAccountPositionId(e.target.value)}>
                  <option value="">Select...</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn" onClick={addAccount} disabled={!username.trim() || !password.trim() || !fullName.trim()}>Add account</button>
            {accounts.length > 0 && (
              <table className="data-table" style={{ marginTop: 14 }}>
                <thead><tr><th>Username</th><th>Full name</th><th>Position</th><th>Password</th><th></th></tr></thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.username}</td>
                      <td>{a.full_name}</td>
                      <td>
                        <select value={a.position_id ?? ""} onChange={(e) => setAccountPosition(a.id, e.target.value)} style={{ maxWidth: 200 }}>
                          <option value="">Unassigned</option>
                          {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <PasswordField value={accountPasswordDraft[a.id] ?? ""} onChange={(v) => setAccountPasswordDraft((d) => ({ ...d, [a.id]: v }))} placeholder="New password" style={{ width: 130 }} />
                          <button className="btn secondary" style={{ fontSize: "0.75rem" }} disabled={!accountPasswordDraft[a.id]} onClick={() => saveAccountPassword(a.id)}>Save</button>
                        </div>
                      </td>
                      <td><button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteAccount(a.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>Sales Person</h2>
            <p className="subtle">Email/password are groundwork for a future login - not required or enforced yet.</p>
            <div className="grid">
              <div className="field"><label>Name</label><input type="text" value={newSalesName} onChange={(e) => setNewSalesName(e.target.value)} /></div>
              <div className="field"><label>Email (optional)</label><input type="text" value={newSalesEmail} onChange={(e) => setNewSalesEmail(e.target.value)} /></div>
              <div className="field"><label>Password (optional)</label><PasswordField value={newSalesPassword} onChange={setNewSalesPassword} /></div>
              <div className="field">
                <label>Position</label>
                <select value={newSalesPositionId} onChange={(e) => setNewSalesPositionId(e.target.value)}>
                  <option value="">Select...</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn secondary" onClick={addSalesPerson} disabled={!newSalesName.trim()}>Add</button>
            {salesPeople.length > 0 && (
              <table className="data-table" style={{ marginTop: 14 }}>
                <thead><tr><th>Name</th><th>Email</th><th>Position</th><th>Password</th><th></th></tr></thead>
                <tbody>
                  {salesPeople.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.email || "-"}</td>
                      <td>
                        <select value={p.position_id ?? ""} onChange={(e) => setSalesPosition(p.id, e.target.value)} style={{ maxWidth: 200 }}>
                          <option value="">Unassigned</option>
                          {positions.map((pos) => <option key={pos.id} value={pos.id}>{pos.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <PasswordField value={salesPasswordDraft[p.id] ?? ""} onChange={(v) => setSalesPasswordDraft((d) => ({ ...d, [p.id]: v }))} placeholder="New password" style={{ width: 130 }} />
                          <button className="btn secondary" style={{ fontSize: "0.75rem" }} disabled={!salesPasswordDraft[p.id]} onClick={() => saveSalesPassword(p.id)}>Save</button>
                        </div>
                      </td>
                      <td><button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteSalesPerson(p.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>Back Office</h2>
            <p className="subtle">Admin-assignable position, with name/email/password.</p>
            <div className="grid">
              <div className="field"><label>Name</label><input type="text" value={newBoName} onChange={(e) => setNewBoName(e.target.value)} /></div>
              <div className="field"><label>Email (optional)</label><input type="text" value={newBoEmail} onChange={(e) => setNewBoEmail(e.target.value)} /></div>
              <div className="field"><label>Password (optional)</label><PasswordField value={newBoPassword} onChange={setNewBoPassword} /></div>
              <div className="field">
                <label>Position</label>
                <select value={newBoPositionId} onChange={(e) => setNewBoPositionId(e.target.value)}>
                  <option value="">Select...</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn secondary" onClick={addBackOffice} disabled={!newBoName.trim()}>Add</button>
            {backOffice.length > 0 && (
              <table className="data-table" style={{ marginTop: 14 }}>
                <thead><tr><th>Name</th><th>Email</th><th>Position</th><th>Password</th><th></th></tr></thead>
                <tbody>
                  {backOffice.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.email || "-"}</td>
                      <td>
                        <select value={p.position_id ?? ""} onChange={(e) => setBackOfficePosition(p.id, e.target.value)} style={{ maxWidth: 200 }}>
                          <option value="">Unassigned</option>
                          {positions.map((pos) => <option key={pos.id} value={pos.id}>{pos.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <PasswordField value={boPasswordDraft[p.id] ?? ""} onChange={(v) => setBoPasswordDraft((d) => ({ ...d, [p.id]: v }))} placeholder="New password" style={{ width: 130 }} />
                          <button className="btn secondary" style={{ fontSize: "0.75rem" }} disabled={!boPasswordDraft[p.id]} onClick={() => saveBackOfficePassword(p.id)}>Save</button>
                        </div>
                      </td>
                      <td><button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteBackOffice(p.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {adminTab === "product" && (
        <div className="card">
          <h2>Item categories</h2>
          <p className="subtle">Order here also controls the dropdown order on the JO Input page.</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" />
            <button className="btn secondary" onClick={addCategory} disabled={!newCategoryName.trim()}>Add</button>
          </div>

          {categories.length === 0 ? <p className="subtle">None yet.</p> : (
            <table className="data-table">
              <thead><tr><th>#</th><th>Name</th><th></th></tr></thead>
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
      )}

      {adminTab === "items" && (
        <div className="card">
          <h2>Materials (component-level, from BOM entries)</h2>
          <p className="subtle">
            Component/material item codes used across BOMs — not finished product codes. Finished item codes from
            Job Orders live under the <b>Items</b> tab in the main nav, not here.
          </p>
          {catalogItems.length === 0 ? <p className="subtle">None yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Item Code</th><th>Description</th><th>Unit</th><th></th></tr></thead>
              <tbody>
                {catalogItems.map((i) => (
                  <tr key={i.item_no}>
                    <td>{i.item_no}</td>
                    <td>
                      {editingItemNo === i.item_no ? (
                        <input type="text" value={editingItemDesc} onChange={(e) => setEditingItemDesc(e.target.value)} style={{ maxWidth: 320 }} />
                      ) : (
                        i.description
                      )}
                    </td>
                    <td>
                      {editingItemNo === i.item_no ? (
                        <input type="text" value={editingItemUnit} onChange={(e) => setEditingItemUnit(e.target.value)} style={{ maxWidth: 70 }} />
                      ) : (
                        i.unit
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {editingItemNo === i.item_no ? (
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => saveCatalogItem(i.item_no)}>Save</button>
                      ) : (
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => { setEditingItemNo(i.item_no); setEditingItemDesc(i.description); setEditingItemUnit(i.unit); }}>Edit</button>
                      )}{" "}
                      <button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteCatalogItem(i.item_no)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
