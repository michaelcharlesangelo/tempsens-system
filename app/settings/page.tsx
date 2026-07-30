"use client";

import { useEffect, useState } from "react";
import QrImage from "@/app/components/QrImage";
import PasswordField from "@/app/components/PasswordField";
import { StationCode, ProductionAccount, ItemCategory, Position, Supplier, SUPPLIER_TAB_CATEGORIES } from "@/lib/jobOrders";

type SettingsTab = "production" | "account" | "product" | "supplier";

export default function SettingsPage() {
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("production");
  const [message, setMessage] = useState<string | null>(null);

  const [stations, setStations] = useState<StationCode[]>([]);
  const [stationName, setStationName] = useState("");
  const [stationDesc, setStationDesc] = useState("");
  const [newStationParamDraft, setNewStationParamDraft] = useState<Record<string, string>>({});

  const [accounts, setAccounts] = useState<ProductionAccount[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [newAccountPositionId, setNewAccountPositionId] = useState("");
  const [accountPasswordDraft, setAccountPasswordDraft] = useState<Record<string, string>>({});

  const [positions, setPositions] = useState<Position[]>([]);
  const [newPositionName, setNewPositionName] = useState("");

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCategory, setNewSupplierCategory] = useState(SUPPLIER_TAB_CATEGORIES[0].value);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingSupplierName, setEditingSupplierName] = useState("");

  async function loadStations() {
    setStations((await (await fetch("/api/station-codes", { cache: "no-store" })).json()).stations ?? []);
  }
  async function loadAccounts() {
    setAccounts((await (await fetch("/api/production-accounts", { cache: "no-store" })).json()).accounts ?? []);
  }
  async function loadPositions() {
    setPositions((await (await fetch("/api/positions", { cache: "no-store" })).json()).positions ?? []);
  }
  async function loadCategories() {
    setCategories((await (await fetch("/api/item-categories", { cache: "no-store" })).json()).categories ?? []);
  }
  async function loadSuppliers() {
    setSuppliers((await (await fetch("/api/suppliers", { cache: "no-store" })).json()).suppliers ?? []);
  }

  useEffect(() => {
    loadStations(); loadAccounts(); loadCategories(); loadPositions(); loadSuppliers();
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

  async function addStationParameter(station: StationCode) {
    const text = (newStationParamDraft[station.id] || "").trim();
    if (!text) return;
    await fetch(`/api/station-codes/${station.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parameters: [...station.parameters, text] }),
    });
    setNewStationParamDraft((d) => ({ ...d, [station.id]: "" }));
    loadStations();
  }

  async function removeStationParameter(station: StationCode, index: number) {
    await fetch(`/api/station-codes/${station.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parameters: station.parameters.filter((_, i) => i !== index) }),
    });
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

  async function deleteStation(id: string) {
    if (!confirm("Delete this station? This can't be undone.")) return;
    const res = await fetch(`/api/station-codes/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || "Failed to delete station."); return; }
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
    if (!confirm("Delete this account? This can't be undone.")) return;
    await fetch(`/api/production-accounts/${id}`, { method: "DELETE" });
    loadAccounts();
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

  async function addSupplier() {
    const res = await fetch("/api/suppliers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSupplierName, tabCategory: newSupplierCategory }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setNewSupplierName("");
    loadSuppliers();
  }

  function startEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id);
    setEditingSupplierName(s.name);
  }

  async function saveEditSupplier(id: string) {
    await fetch(`/api/suppliers/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingSupplierName }),
    });
    setEditingSupplierId(null);
    loadSuppliers();
  }

  async function setSupplierCategory(id: string, tabCategory: string) {
    await fetch(`/api/suppliers/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tabCategory }),
    });
    loadSuppliers();
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Delete this supplier?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    loadSuppliers();
  }

  return (
    <>
      {message && <div className="warn">{message}</div>}

      <div className="pill-toggle equal-width" style={{ marginBottom: 16 }}>
        <button className={settingsTab === "production" ? "active" : ""} onClick={() => setSettingsTab("production")}>Production</button>
        <button className={settingsTab === "account" ? "active" : ""} onClick={() => setSettingsTab("account")}>Account</button>
        <button className={settingsTab === "product" ? "active" : ""} onClick={() => setSettingsTab("product")}>Product</button>
        <button className={settingsTab === "supplier" ? "active" : ""} onClick={() => setSettingsTab("supplier")}>Supplier</button>
      </div>

      {settingsTab === "production" && (
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
                {stations.map((s, i) => (
                  <div key={s.id} style={{ textAlign: "center", border: "1px solid var(--border)", borderRadius: 8, padding: 12, opacity: s.active ? 1 : 0.4 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.72rem", color: "var(--accent-dark)" }}>STEP {s.sequence}</div>
                    <QrImage value={s.code} size={110} />
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: 4 }}>{s.station_name}</div>

                    <div style={{ textAlign: "left", marginTop: 8 }}>
                      <div className="subtle" style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                        Parameters to check
                      </div>
                      {s.parameters.length === 0 ? (
                        <p className="subtle" style={{ fontSize: "0.75rem", margin: "0 0 6px" }}>None yet.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
                          {s.parameters.map((p, pi) => (
                            <div key={pi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, fontSize: "0.75rem", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 6px" }}>
                              <span>{pi + 1}. {p}</span>
                              <button className="btn danger" style={{ padding: "1px 6px", fontSize: "0.68rem" }} onClick={() => removeStationParameter(s, pi)}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 4 }}>
                        <input
                          type="text"
                          value={newStationParamDraft[s.id] ?? ""}
                          onChange={(e) => setNewStationParamDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                          placeholder="e.g. 200degC for 60min"
                          style={{ fontSize: "0.75rem" }}
                        />
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.72rem", whiteSpace: "nowrap" }} onClick={() => addStationParameter(s)}>+ Add</button>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 8 }}>
                      <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => moveStation(s.id, "up")} disabled={i === 0}>↑</button>
                      <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => moveStation(s.id, "down")} disabled={i === stations.length - 1}>↓</button>
                      <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => toggleStation(s.id)}>{s.active ? "Off" : "On"}</button>
                      <button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteStation(s.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn secondary" style={{ marginTop: 14 }} onClick={() => window.print()}>Print all QR codes</button>
          </div>
        </>
      )}

      {settingsTab === "account" && (
        <>
          <div className="card">
            <h2>Position types</h2>
            <p className="subtle">
              Extensible list of roles assignable to Accounts below. Sales, Sales Manager, and General Manager are the
              positions that make an account selectable as "Sales" on a Job Order.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <input type="text" value={newPositionName} onChange={(e) => setNewPositionName(e.target.value)} placeholder="New position name" />
              <button className="btn secondary" onClick={addPosition} disabled={!newPositionName.trim()}>Add</button>
            </div>
            {positions.length === 0 ? <p className="subtle">None yet.</p> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {positions.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--panel-muted)",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{p.name}</span>
                    <button className="btn danger" style={{ padding: "3px 7px", fontSize: "0.68rem", flex: "none" }} onClick={() => deletePosition(p.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Accounts</h2>
            <p className="subtle">Register with a name, email/username, password, and position.</p>
            <div className="grid">
              <div className="field"><label>Name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="field"><label>Email / Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
              <div className="field"><label>Password</label><PasswordField value={password} onChange={setPassword} /></div>
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
                <thead><tr><th>Email / Username</th><th>Full name</th><th>Position</th><th>New password</th><th></th></tr></thead>
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
                          <PasswordField value={accountPasswordDraft[a.id] ?? ""} onChange={(v) => setAccountPasswordDraft((d) => ({ ...d, [a.id]: v }))} placeholder="Set new password" style={{ width: 130 }} />
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
        </>
      )}

      {settingsTab === "product" && (
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

      {settingsTab === "supplier" && (
        <div className="card">
          <h2>Suppliers</h2>
          <p className="subtle">
            Manage the PO Out supplier dropdown and which of the 7 Excel-style tabs each supplier files under.
            Suppliers added inline from PO Out land in Other Import by default — reassign them here.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value.toUpperCase())} placeholder="New supplier name" />
            <select value={newSupplierCategory} onChange={(e) => setNewSupplierCategory(e.target.value as typeof newSupplierCategory)}>
              {SUPPLIER_TAB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button className="btn secondary" onClick={addSupplier} disabled={!newSupplierName.trim()}>Add</button>
          </div>

          {suppliers.length === 0 ? <p className="subtle">None yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Tab</th><th></th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {editingSupplierId === s.id ? (
                        <input type="text" value={editingSupplierName} onChange={(e) => setEditingSupplierName(e.target.value.toUpperCase())} style={{ maxWidth: 220 }} />
                      ) : (
                        s.name
                      )}
                    </td>
                    <td>
                      <select value={s.tab_category} onChange={(e) => setSupplierCategory(s.id, e.target.value)} style={{ maxWidth: 180 }}>
                        {SUPPLIER_TAB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {editingSupplierId === s.id ? (
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => saveEditSupplier(s.id)}>Save</button>
                      ) : (
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => startEditSupplier(s)}>Rename</button>
                      )}{" "}
                      <button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteSupplier(s.id)}>Delete</button>
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
