"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import QrImage from "@/app/components/QrImage";
import { StationCode, ProductionAccount, SalesPerson, ItemCategory } from "@/lib/jobOrders";

type AdminTab = "production" | "sales" | "product" | "items";

interface CatalogItem { item_no: string; description: string; category: string | null; }

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
  const [newSalesEmail, setNewSalesEmail] = useState("");
  const [newSalesPassword, setNewSalesPassword] = useState("");
  const [editingPasswordId, setEditingPasswordId] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [editingItemNo, setEditingItemNo] = useState<string | null>(null);
  const [editingItemDesc, setEditingItemDesc] = useState("");

  async function loadStations() {
    setStations((await (await fetch("/api/station-codes", { cache: "no-store" })).json()).stations ?? []);
  }
  async function loadAccounts() {
    setAccounts((await (await fetch("/api/production-accounts", { cache: "no-store" })).json()).accounts ?? []);
  }
  async function loadSales() {
    setSalesPeople((await (await fetch("/api/sales-people", { cache: "no-store" })).json()).salesPeople ?? []);
  }
  async function loadCategories() {
    setCategories((await (await fetch("/api/item-categories", { cache: "no-store" })).json()).categories ?? []);
  }
  async function loadCatalog() {
    setCatalogItems((await (await fetch("/api/item-catalog?kind=material", { cache: "no-store" })).json()).items ?? []);
  }

  useEffect(() => {
    loadStations(); loadAccounts(); loadSales(); loadCategories(); loadCatalog();
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
      body: JSON.stringify({ username, password, fullName }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setUsername(""); setPassword(""); setFullName("");
    loadAccounts();
  }

  async function addSalesPerson() {
    const res = await fetch("/api/sales-people", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSalesName, email: newSalesEmail, password: newSalesPassword }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    setNewSalesName(""); setNewSalesEmail(""); setNewSalesPassword("");
    loadSales();
  }

  async function savePassword(id: string) {
    if (!passwordDraft) { setEditingPasswordId(null); return; }
    await fetch(`/api/sales-people/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: passwordDraft }),
    });
    setEditingPasswordId(null);
    setPasswordDraft("");
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
      body: JSON.stringify({ itemNo, description: editingItemDesc }),
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
        <button className={adminTab === "sales" ? "active" : ""} onClick={() => setAdminTab("sales")}>Sales</button>
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
          <p className="subtle">Email/password are groundwork for a future login - not required or enforced yet.</p>
          <div className="grid">
            <div className="field"><label>Name</label><input type="text" value={newSalesName} onChange={(e) => setNewSalesName(e.target.value)} /></div>
            <div className="field"><label>Email (optional)</label><input type="text" value={newSalesEmail} onChange={(e) => setNewSalesEmail(e.target.value)} /></div>
            <div className="field"><label>Password (optional)</label><input type="password" value={newSalesPassword} onChange={(e) => setNewSalesPassword(e.target.value)} /></div>
          </div>
          <button className="btn secondary" onClick={addSalesPerson} disabled={!newSalesName.trim()}>Add</button>
          {salesPeople.length > 0 && (
            <table className="data-table" style={{ marginTop: 14 }}>
              <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
              <tbody>
                {salesPeople.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.email || "-"}</td>
                    <td>
                      {editingPasswordId === p.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <input type="password" placeholder="New password" value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)} style={{ width: 140 }} />
                          <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => savePassword(p.id)}>Save</button>
                        </div>
                      ) : (
                        <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => { setEditingPasswordId(p.id); setPasswordDraft(""); }}>Set password</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
              <thead><tr><th>Item Code</th><th>Description</th><th></th></tr></thead>
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
                    <td style={{ whiteSpace: "nowrap" }}>
                      {editingItemNo === i.item_no ? (
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => saveCatalogItem(i.item_no)}>Save</button>
                      ) : (
                        <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => { setEditingItemNo(i.item_no); setEditingItemDesc(i.description); }}>Edit</button>
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
