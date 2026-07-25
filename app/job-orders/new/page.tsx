"use client";

import { useEffect, useState } from "react";
import NavBar from "@/app/components/NavBar";
import { ItemCategory } from "@/lib/jobOrders";

interface CatalogItem {
  item_code: string;
  description: string;
}

export default function NewJobOrderPage() {
  const [customerName, setCustomerName] = useState("");
  const [soNo, setSoNo] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [itemCode, setItemCode] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [deadline, setDeadline] = useState("");

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/item-categories", { cache: "no-store" }).then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
  }, []);

  async function onItemCodeChange(value: string) {
    setItemCode(value);
    if (value.length < 1) {
      setCatalogSuggestions([]);
      return;
    }
    const res = await fetch(`/api/item-catalog?q=${encodeURIComponent(value)}`, { cache: "no-store" });
    const data = await res.json();
    setCatalogSuggestions(data.items ?? []);
  }

  function pickSuggestion(item: CatalogItem) {
    setItemCode(item.item_code);
    setItemDescription(item.description);
    setCatalogSuggestions([]);
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/job-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName, soNo, itemCategory, itemDescription,
          quantity: Number(quantity), itemCode, serialNo, deadline: deadline || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create job order.");
        return;
      }
      window.location.href = `/job-orders/${data.jobOrder.id}`;
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <NavBar active="job-orders" />
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>New job order</h2>
        <div className="grid">
          <div className="field">
            <label>Customer name</label>
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="field">
            <label>SO No.</label>
            <input type="text" value={soNo} onChange={(e) => setSoNo(e.target.value)} />
          </div>
          <div className="field">
            <label>Item category</label>
            <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
              <option value="">Select...</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ position: "relative" }}>
            <label>Item code</label>
            <input type="text" value={itemCode} onChange={(e) => onItemCodeChange(e.target.value)} autoComplete="off" />
            {catalogSuggestions.length > 0 && (
              <div style={{ position: "absolute", zIndex: 10, background: "white", border: "1px solid var(--border)", borderRadius: 8, width: "100%", maxHeight: 160, overflowY: "auto" }}>
                {catalogSuggestions.map((s) => (
                  <div key={s.item_code} onClick={() => pickSuggestion(s)} style={{ padding: "8px 10px", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--panel-muted)" }}>
                    <b>{s.item_code}</b> — {s.description}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="field">
            <label>Serial No.</label>
            <input type="text" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          </div>
          <div className="field">
            <label>Deadline (optional)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Item description</label>
          <textarea value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
        </div>

        {error && <p className="error-text">{error}</p>}
        <button className="btn" onClick={submit} disabled={saving || !customerName.trim()}>
          {saving ? "Creating..." : "Create job order (draft)"}
        </button>
        <p className="subtle" style={{ marginTop: 10 }}>
          Drawing and PO attachments, plus the BOM, are added from the job order's page after it's created.
        </p>
      </div>
    </>
  );
}
