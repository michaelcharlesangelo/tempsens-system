"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import DateField from "@/app/components/DateField";
import QrImage from "@/app/components/QrImage";
import TruncatedText from "@/app/components/TruncatedText";
import { JobOrder, BomItem, JobOrderHistoryEntry, ProductionLog, FabricationItem, fmtDate, fmtDateTime, generateSerials, formatSerialRange, splitMatch } from "@/lib/jobOrders";

interface CatalogItem { item_no: string; description: string; unit?: string; }

// Bolds the portion of an item code that matches the current search term
// so the matched prefix stands out in suggestion lists.
function HighlightedCode({ text, term }: { text: string; term: string }) {
  const [before, match, after] = splitMatch(text, term);
  return <>{before}<b>{match}</b>{after}</>;
}

export default function ProductionJobOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [bom, setBom] = useState<BomItem[]>([]);
  const [history, setHistory] = useState<JobOrderHistoryEntry[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [showAllUnitsQc, setShowAllUnitsQc] = useState(false);

  // A single base serial (e.g. "2604/0100") generates the full sequential
  // range for the JO's quantity on save - see generateSerials(). Editing
  // one JO with 60 units doesn't mean 60 input boxes.
  const [baseSerial, setBaseSerial] = useState("");
  const [finishDate, setFinishDate] = useState("");

  const [newItemNo, setNewItemNo] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("pcs");
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([]);
  const [newItemKnown, setNewItemKnown] = useState(false);
  const [savingRow, setSavingRow] = useState(false);

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ itemNo: string; description: string; qty: string; unit: string }>({ itemNo: "", description: "", qty: "", unit: "" });
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  // ---------------- Fabrication ----------------
  const [fabricationItems, setFabricationItems] = useState<FabricationItem[]>([]);
  const [newFabDescription, setNewFabDescription] = useState("");
  const [newFabQty, setNewFabQty] = useState("1");
  const [newFabUnit, setNewFabUnit] = useState("pcs");
  const [savingFabRow, setSavingFabRow] = useState(false);
  const [editingFabRowId, setEditingFabRowId] = useState<string | null>(null);
  const [editFabDraft, setEditFabDraft] = useState<{ description: string; qty: string; unit: string }>({ description: "", qty: "", unit: "" });
  const [fabCommentDraft, setFabCommentDraft] = useState<Record<string, string>>({});
  const [savedFabRowId, setSavedFabRowId] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/job-orders/${id}?tab=production-manager`, { cache: "no-store" });
    const data = await res.json();
    setJobOrder(data.jobOrder);
    // Newest item last, so a freshly added row lands at the bottom of the
    // BOM instead of jumping to the top ahead of everything already there.
    const rows: BomItem[] = data.bom ?? [];
    setBom([...rows].sort((a, b) => (a.created_at > b.created_at ? 1 : -1)));
    setHistory(data.history ?? []);
    setProductionLogs(data.productionLogs ?? []);
    setBaseSerial(data.jobOrder?.serial_numbers?.[0] ?? "");
    setFinishDate(data.jobOrder?.finish_date ? data.jobOrder.finish_date.slice(0, 10) : "");

    const fabRes = await fetch(`/api/fabrication?jobOrderId=${id}`, { cache: "no-store" });
    const fabData = await fabRes.json();
    setFabricationItems(fabData.items ?? []);
  }

  useEffect(() => { if (id) load(); }, [id]);

  async function printJobOrder() {
    if (!jobOrder) return;

    // QC parameter names/values routinely contain <, >, & (e.g. "IR > 100MΩ")
    // - interpolated raw into this HTML string, those characters break the
    // markup and garble the printed page. React escapes automatically for
    // the on-screen table; this string template doesn't, so it must be done
    // by hand for every dynamic value below.
    const esc = (value: unknown): string =>
      String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

    // Reverted to encoding the bare barcode, not a full link - a link made
    // for a visually denser QR (more modules for the same physical size)
    // that stopped scanning reliably even at a larger print size, whereas
    // the plain short code was confirmed working before. This app's own
    // /production scanner is what actually reads this - see QrScanner.
    const qrDataUrl = jobOrder.barcode ? await QRCode.toDataURL(jobOrder.barcode, { width: 300, margin: 1 }) : "";

    const bomRows = bom.map((b) => `
      <tr>
        <td>${esc(b.item_no)}</td><td>${esc(b.description)}</td><td>${esc(b.qty)}</td><td>${esc(b.unit)}</td>
        <td>${esc(b.actual_qty ?? "-")}</td><td>${esc(b.actual_unit ?? "-")}</td><td>${esc(b.comment || "-")}</td>
      </tr>`).join("");

    const comments = history.filter((h) => h.comment);
    const commentRows = comments.length
      ? comments.map((h) => `<div class="comment"><b>${esc(h.changed_by)}</b> <span class="muted">(${esc(fmtDateTime(h.changed_at))})</span>: ${esc(h.comment)}</div>`).join("")
      : `<div class="muted">None.</div>`;

    const qcRows = productionLogs.flatMap((log) => {
      // Print only shows the first unit's readings - full per-unit detail is
      // available on-screen instead of bloating the printed sheet.
      const firstUnitResults = log.results.filter((r) => (r.unit ?? 0) === 0);
      const rows = firstUnitResults.length > 0 ? firstUnitResults : (log.results.length > 0 ? [] : [{ parameter: "-", actual: "-" }]);
      return rows.map((r) => `
        <tr>
          <td>${esc(fmtDateTime(log.scanned_at))}</td><td>${esc(log.station?.station_name ?? "-")}</td>
          <td>${esc(r.parameter)}</td><td>${esc(r.actual || "-")}</td><td>${esc(log.account?.full_name ?? log.scanned_by_label ?? "-")}</td>
        </tr>`);
    }).join("");

    const title = `Job Order, ${esc(jobOrder.so_no)}`;
    const html = `
      <html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body { font-family: Arial, sans-serif; font-size: 9.5px; color: #111; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .header h1 { font-size: 16px; margin: 0; flex: 1; text-align: center; }
        .qr { display: flex; align-items: center; gap: 8px; width: 160px; justify-content: flex-end; }
        .qr img { display: block; }
        table.info { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; font-size: 9.5px; }
        table.info td { padding: 3px 6px; vertical-align: top; word-wrap: break-word; }
        table.info td.label { font-weight: bold; white-space: nowrap; }
        .section-title { font-weight: bold; text-transform: uppercase; font-size: 9px; margin: 8px 0 4px; border-top: 1px solid #999; padding-top: 5px; }
        .comment { font-size: 9px; padding: 2px 0; }
        .muted { color: #666; }
        table.bom, table.qc { width: 100%; border-collapse: collapse; margin-top: 4px; table-layout: fixed; }
        table.bom th, table.bom td, table.qc th, table.qc td { border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 9px; line-height: 1.35; word-wrap: break-word; white-space: normal; }
        table.bom th { background: #eee; }
        table.qc th { background: #eee; }
      </style>
      </head><body onload="window.focus();window.print();">
        <div class="header">
          <div style="width:160px"></div>
          <h1>JOB ORDER</h1>
          <div class="qr">
            ${qrDataUrl ? `<img src="${qrDataUrl}" width="150" height="150" />` : ""}
          </div>
        </div>
        <table class="info">
          <colgroup><col style="width:17%"><col style="width:33%"><col style="width:17%"><col style="width:33%"></colgroup>
          <tr><td class="label">Customer Name</td><td>${esc(jobOrder.customer_name)}</td><td class="label">Item Code</td><td>${esc(jobOrder.item_no)}</td></tr>
          <tr><td class="label">SO Number</td><td>${esc(jobOrder.so_no)}</td><td class="label">JO Date</td><td>${esc(fmtDate(jobOrder.created_at))}</td></tr>
          <tr><td class="label">Item Description</td><td>${esc(jobOrder.item_description)}</td><td class="label">Deadline</td><td>${esc(fmtDate(jobOrder.deadline))}</td></tr>
          <tr><td class="label">Category</td><td>${esc(jobOrder.item_category)}</td><td class="label">Drawing Number</td><td>${esc(jobOrder.drawing_number || "-")}</td></tr>
          <tr><td class="label">Quantity</td><td>${esc(jobOrder.quantity)}</td><td class="label">Sales</td><td>${esc(jobOrder.sales_person_name)}</td></tr>
          <tr><td class="label">Serial Number(s)</td><td>${esc(formatSerialRange(jobOrder.serial_numbers ?? []))}</td><td class="label">Finish Date</td><td>${esc(fmtDate(jobOrder.finish_date))}</td></tr>
        </table>

        <div class="section-title">Comments</div>
        ${commentRows}

        <div class="section-title">Material BOM</div>
        <table class="bom">
          <colgroup>
            <col style="width:10%"><col style="width:34%"><col style="width:6%"><col style="width:6%">
            <col style="width:7%"><col style="width:7%"><col style="width:30%">
          </colgroup>
          <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Actual</th><th>Unit</th><th>Comment (to Warehouse)</th></tr></thead>
          <tbody>${bomRows || `<tr><td colspan="7">No items yet.</td></tr>`}</tbody>
        </table>

        <div class="section-title">QC Parameter</div>
        <table class="qc">
          <colgroup>
            <col style="width:16%"><col style="width:16%"><col style="width:30%"><col style="width:20%"><col style="width:18%">
          </colgroup>
          <thead><tr><th>Time</th><th>Station</th><th>Parameter</th><th>Actual</th><th>Checked By</th></tr></thead>
          <tbody>${qcRows || `<tr><td colspan="5">No station scans yet.</td></tr>`}</tbody>
        </table>
      </body></html>
    `;

    // Blob URL instead of window.open("") + document.write - gives the
    // print window a real URL/title instead of "about:blank" in the
    // browser's own print header/footer.
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(blobUrl, "_blank", "width=850,height=1100");
  }

  async function saveDetails() {
    if (!jobOrder) return;
    const serials = generateSerials(baseSerial, jobOrder.quantity);
    const res = await fetch(`/api/job-orders/${id}/details`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serialNumbers: serials, finishDate }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to save."); return; }
    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 1800);
    load();
  }

  async function onNewItemNoChange(value: string) {
    const upper = value.toUpperCase();
    setNewItemNo(upper);
    setNewItemKnown(false);
    if (!upper) { setSuggestions([]); return; }
    const res = await fetch(`/api/item-catalog?q=${encodeURIComponent(upper)}`, { cache: "no-store" });
    const data = await res.json();
    const items: CatalogItem[] = data.items ?? [];
    setSuggestions(items);
    // Exact match while typing (no click needed) - autofills unit/description
    // straight away since the code is already fully known to the catalog,
    // and locks those fields since they belong to the catalog entry.
    const exact = items.find((s) => s.item_no.toUpperCase() === upper);
    if (exact) {
      setNewItemKnown(true);
      if (exact.unit) setNewUnit(exact.unit);
      setNewDescription(exact.description || "");
    }
  }

  function pickSuggestion(item: CatalogItem) {
    setNewItemNo(item.item_no);
    setNewDescription(item.description);
    if (item.unit) setNewUnit(item.unit);
    setNewItemKnown(true);
    setSuggestions([]);
  }

  async function addRow() {
    setSavingRow(true);
    const res = await fetch(`/api/job-orders/${id}/bom`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      // No item code yet (not in stock / not decided) - still gets added
      // to the BOM, just auto-flagged Not Available so it shows up on
      // Warehouse Manager's list to chase down instead of silently blocking.
      body: JSON.stringify({ itemNo: newItemNo, description: newDescription, qty: newQty, unit: newUnit, materialReady: !!newItemNo.trim() }),
    });
    const data = await res.json();
    setSavingRow(false);
    if (!res.ok) { setMessage(data.error || "Failed to add item."); return; }
    setNewItemNo(""); setNewDescription(""); setNewQty("1"); setNewUnit("pcs"); setNewItemKnown(false);
    load();
  }

  function startEditRow(row: BomItem) {
    setEditingRowId(row.id);
    setEditDraft({ itemNo: row.item_no, description: row.description, qty: String(row.qty), unit: row.unit });
  }

  async function saveEditRow(rowId: string) {
    await fetch(`/api/job-orders/${id}/bom/${rowId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemNo: editDraft.itemNo, description: editDraft.description, qty: editDraft.qty, unit: editDraft.unit }),
    });
    setEditingRowId(null);
    load();
  }

  async function toggleNotAvailable(row: BomItem) {
    // Optimistic update - reflect the click immediately instead of waiting
    // on the reload roundtrip, which is what made the tick feel like it
    // "sometimes doesn't stick" on a slow connection.
    const nextReady = !row.material_ready;
    setBom((cur) => cur.map((r) => (r.id === row.id ? { ...r, material_ready: nextReady } : r)));
    try {
      const res = await fetch(`/api/job-orders/${id}/bom/${row.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialReady: nextReady }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setBom((cur) => cur.map((r) => (r.id === row.id ? { ...r, material_ready: row.material_ready } : r)));
      setMessage("Couldn't save that change - please try again.");
      return;
    }
    load();
  }

  async function saveComment(row: BomItem) {
    const comment = commentDraft[row.id] ?? row.comment ?? "";
    await fetch(`/api/job-orders/${id}/bom/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    setSavedRowId(row.id);
    setTimeout(() => setSavedRowId((cur) => (cur === row.id ? null : cur)), 1800);
    load();
  }

  async function deleteRow(rowId: string) {
    if (!confirm("Remove this BOM item?")) return;
    await fetch(`/api/job-orders/${id}/bom/${rowId}`, { method: "DELETE" });
    load();
  }

  // ---------------- Fabrication ----------------
  async function addFabRow() {
    setSavingFabRow(true);
    try {
      const res = await fetch("/api/fabrication", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobOrderId: id, description: newFabDescription, qty: newFabQty, unit: newFabUnit }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to add fabrication item."); return; }
      setNewFabDescription(""); setNewFabQty("1"); setNewFabUnit("pcs");
      load();
    } finally {
      setSavingFabRow(false);
    }
  }

  function startEditFabRow(row: FabricationItem) {
    setEditingFabRowId(row.id);
    setEditFabDraft({ description: row.description, qty: String(row.qty), unit: row.unit });
  }

  async function saveEditFabRow(rowId: string) {
    const fd = new FormData();
    fd.append("description", editFabDraft.description);
    fd.append("qty", editFabDraft.qty);
    fd.append("unit", editFabDraft.unit);
    await fetch(`/api/fabrication/${rowId}`, { method: "PATCH", body: fd });
    setEditingFabRowId(null);
    load();
  }

  async function toggleFabFinish(row: FabricationItem) {
    const fd = new FormData();
    fd.append("status", row.status === "finish" ? "production" : "finish");
    await fetch(`/api/fabrication/${row.id}`, { method: "PATCH", body: fd });
    load();
  }

  async function saveFabComment(row: FabricationItem) {
    const fd = new FormData();
    fd.append("comment", fabCommentDraft[row.id] ?? row.comment ?? "");
    await fetch(`/api/fabrication/${row.id}`, { method: "PATCH", body: fd });
    setSavedFabRowId(row.id);
    setTimeout(() => setSavedFabRowId((cur) => (cur === row.id ? null : cur)), 1800);
    load();
  }

  async function uploadFabPhotos(row: FabricationItem, files: FileList | null) {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("photos", f));
    await fetch(`/api/fabrication/${row.id}`, { method: "PATCH", body: fd });
    load();
  }

  async function deleteFabRow(rowId: string) {
    if (!confirm("Remove this fabrication item?")) return;
    await fetch(`/api/fabrication/${rowId}`, { method: "DELETE" });
    load();
  }

  async function deleteFabPhoto(row: FabricationItem, path: string) {
    if (!confirm("Remove this photo? In case it was the wrong attachment.")) return;
    const fd = new FormData();
    fd.append("removePhoto", path);
    await fetch(`/api/fabrication/${row.id}`, { method: "PATCH", body: fd });
    load();
  }

  async function viewFabPhoto(path: string) {
    const res = await fetch(`/api/complaints/x/photo?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  async function printFabricationJo(row: FabricationItem) {
    if (!jobOrder) return;
    const esc = (value: unknown): string =>
      String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

    // Signed URLs can't be fetched inline inside the template string below
    // (it has to stay synchronous once we start building it), so resolve
    // every attached photo's URL up front. Capped to a handful, laid out
    // in one fixed-size non-wrapping row - unbounded photos (or a fixed
    // container relying on CSS overflow to clip them) is what was pushing
    // this onto a second physical page in some browsers' print engines.
    const photoUrls = (
      await Promise.all(
        row.photo_paths.slice(0, 6).map(async (p) => {
          try {
            const res = await fetch(`/api/complaints/x/photo?path=${encodeURIComponent(p)}`, { cache: "no-store" });
            const data = await res.json();
            return typeof data.url === "string" ? data.url : null;
          } catch {
            return null;
          }
        })
      )
    ).filter((u): u is string => !!u);

    const html = `
      <html><head><meta charset="utf-8"><title>Fabrication JO - ${esc(jobOrder.so_no)}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 9px; color: #111; line-height: 1.4; }
        h1 { font-size: 13px; text-align: center; margin: 0 0 8px; }
        table.info { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.info td { padding: 3px 6px; vertical-align: top; word-wrap: break-word; }
        table.info td.label { font-weight: bold; white-space: nowrap; width: 22%; }
        .photos-title { font-weight: bold; text-transform: uppercase; font-size: 8px; margin: 8px 0 4px; border-top: 1px solid #999; padding-top: 5px; }
        .photos-row { display: flex; gap: 4px; flex-wrap: nowrap; }
        .photos-row img { height: 30mm; width: 30mm; object-fit: cover; border: 1px solid #ccc; }
      </style>
      </head><body onload="window.focus();window.print();">
        <h1>FABRICATION JO</h1>
        <table class="info">
          <colgroup><col style="width:12%"><col style="width:38%"><col style="width:12%"><col style="width:38%"></colgroup>
          <tr><td class="label">SO Number</td><td>${esc(jobOrder.so_no)}</td><td class="label">JO Date</td><td>${esc(fmtDate(jobOrder.created_at))}</td></tr>
          <tr><td class="label">Item Description</td><td>${esc(row.description)}</td><td class="label">Deadline</td><td>${esc(fmtDate(jobOrder.deadline))}</td></tr>
          <tr><td class="label">Qty</td><td>${esc(row.qty)} ${esc(row.unit)}</td><td class="label">Drawing Number</td><td>${esc(jobOrder.drawing_number || "-")}</td></tr>
          <tr><td class="label">Note</td><td colspan="3">${row.comment ? esc(row.comment) : '<span style="color:#999;">No comment.</span>'}</td></tr>
        </table>
        ${photoUrls.length > 0 ? `<div class="photos-title">Photos</div><div class="photos-row">${photoUrls.map((u) => `<img src="${esc(u)}" />`).join("")}</div>` : ""}
      </body></html>
    `;
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(blobUrl, "_blank", "width=850,height=650");
  }

  if (!jobOrder) {
    return <p className="subtle">Loading...</p>;
  }

  const minFinishDate = jobOrder.jo_date ? jobOrder.jo_date.slice(0, 10) : jobOrder.created_at.slice(0, 10);
  // Once production is finished there's nothing left to fill in - the page
  // becomes a read-only record, same shape as the printed JO.
  const readOnly = jobOrder.status === "completed";
  const previewSerials = generateSerials(baseSerial, jobOrder.quantity);

  return (
    <>
      <p style={{ marginBottom: 10 }}>
        <a
          href="/production-manager"
          className="subtle"
          onClick={(e) => {
            // Goes back to whichever tab actually linked here (Sales
            // Support Supervisor's costing table, Production Manager's own
            // list, etc.) instead of always landing on Production Manager.
            if (typeof window !== "undefined" && window.history.length > 1) {
              e.preventDefault();
              router.back();
            }
          }}
        >
          ← Back
        </a>
      </p>
      {message && <div className="warn">{message}</div>}
      {readOnly && (
        <div className="card" style={{ background: "#e6f0ea", borderColor: "var(--good)" }}>
          <b style={{ color: "var(--good)" }}>Finished Production</b> — this job order is complete and read-only. Use Print JO for a record copy.
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ width: 90 }} />
          <h2 style={{ margin: 0, textAlign: "center", flex: 1 }}>JOB ORDER</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px", whiteSpace: "nowrap" }} onClick={printJobOrder}>Print JO</button>
            {jobOrder.barcode && <QrImage value={jobOrder.barcode} size={180} />}
          </div>
        </div>

        <div className="form-sheet" style={{ marginTop: 6 }}>
          <div className="form-sheet-col">
            <div className="form-row"><label>Customer Name</label><span>:</span><span>{jobOrder.customer_name}</span></div>
            <div className="form-row"><label>SO Number</label><span>:</span><span>{jobOrder.so_no}</span></div>
            <div className="form-row"><label>Item Description</label><span>:</span><span>{jobOrder.item_description}</span></div>
            <div className="form-row"><label>Category</label><span>:</span><span>{jobOrder.item_category}</span></div>
            <div className="form-row"><label>Quantity</label><span>:</span><span>{jobOrder.quantity}</span></div>
          </div>
          <div className="form-sheet-col">
            <div className="form-row"><label>Item Code</label><span>:</span><span>{jobOrder.item_no}</span></div>
            <div className="form-row"><label>JO Date</label><span>:</span><span>{fmtDate(jobOrder.created_at)}</span></div>
            <div className="form-row"><label>Deadline</label><span>:</span><span>{fmtDate(jobOrder.deadline)}{jobOrder.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</span></div>
            <div className="form-row"><label>Drawing Number</label><span>:</span><span>{jobOrder.drawing_number || "-"}</span></div>
            <div className="form-row"><label>Sales</label><span>:</span><span>{jobOrder.sales_person_name}</span></div>
          </div>
        </div>

        {/* Its own full-width block after both form-sheet columns, rather
            than nested inside the left column, so on mobile (where the
            columns stack) it lands after every fillable field instead of
            interrupting them partway down. */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--panel-muted)" }}>
          <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>
            Comments
          </div>
          {history.filter((h) => h.comment).length === 0 ? (
            <p className="subtle" style={{ fontSize: "0.8rem", margin: 0 }}>None yet.</p>
          ) : (
            history.filter((h) => h.comment).map((h) => (
              <div key={h.id} style={{ fontSize: "0.8rem", padding: "3px 0" }}>
                <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
              </div>
            ))
          )}
        </div>

        <div className="form-sheet" style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="form-sheet-col">
            <div className="form-row">
              <label>Base Serial No.</label>
              <span>:</span>
              {readOnly ? (
                <span>{formatSerialRange(jobOrder.serial_numbers ?? [])}</span>
              ) : (
                <input type="text" value={baseSerial} onChange={(e) => setBaseSerial(e.target.value)} placeholder="e.g. 2604/0100" />
              )}
            </div>
            {!readOnly && jobOrder.quantity > 1 && baseSerial.trim() && (
              <p className="subtle" style={{ fontSize: "0.76rem", margin: "2px 0 0" }}>
                Generates {jobOrder.quantity} serials: {formatSerialRange(previewSerials)}
              </p>
            )}
          </div>
          <div className="form-sheet-col">
            <div className="form-row">
              <label>Est. Finish Date</label><span>:</span>
              {readOnly ? <span>{fmtDate(jobOrder.finish_date)}</span> : <DateField value={finishDate} onChange={setFinishDate} min={minFinishDate} />}
            </div>
          </div>
        </div>
        {!readOnly && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button className="btn secondary" onClick={saveDetails}>Save Serial Number / Est. Finish Date</button>
            {detailsSaved && <span style={{ color: "var(--good)", fontSize: "0.82rem" }}>✓ Saved</span>}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Material BOM</h2>
        </div>

        {bom.length === 0 ? <p className="subtle" style={{ marginTop: 10 }}>No items yet.</p> : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="data-table fixed">
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Actual</th><th>Unit</th><th>N/A</th><th>Comment (to Warehouse)</th>{!readOnly && <th></th>}</tr></thead>
              <tbody>
                {bom.map((row) => (
                  <tr key={row.id}>
                    {!readOnly && editingRowId === row.id ? (
                      <>
                        <td><input type="text" value={editDraft.itemNo} onChange={(e) => setEditDraft({ ...editDraft, itemNo: e.target.value.toUpperCase() })} /></td>
                        <td><input type="text" value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} /></td>
                        <td><input type="number" value={editDraft.qty} onChange={(e) => setEditDraft({ ...editDraft, qty: e.target.value })} style={{ width: 60 }} /></td>
                        <td><input type="text" value={editDraft.unit} onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })} style={{ width: 55 }} /></td>
                        <td className="subtle">{row.actual_qty ?? "-"}</td>
                        <td className="subtle">{row.actual_unit ?? "-"}</td>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={!row.material_ready} onChange={() => toggleNotAvailable(row)} style={{ width: "auto" }} /></td>
                        <td className="subtle">{row.comment || "-"}</td>
                        <td><button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => saveEditRow(row.id)}>Save</button></td>
                      </>
                    ) : (
                      <>
                        <td>{row.item_no || <span className="subtle">-</span>}</td>
                        <td>{row.description}</td>
                        <td>{row.qty}</td>
                        <td>{row.unit}</td>
                        <td>{row.actual_qty ?? <span className="subtle">-</span>}</td>
                        <td>{row.actual_unit ?? <span className="subtle">-</span>}</td>
                        <td style={{ textAlign: "center" }}>
                          {readOnly ? (
                            !row.material_ready ? "✓" : ""
                          ) : (
                            <input type="checkbox" checked={!row.material_ready} onChange={() => toggleNotAvailable(row)} style={{ width: "auto" }} />
                          )}
                        </td>
                        {readOnly ? (
                          <td>{row.comment || <span className="subtle">-</span>}</td>
                        ) : (
                          <>
                            <td>
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input
                                  type="text"
                                  placeholder="Note for Warehouse..."
                                  value={commentDraft[row.id] ?? row.comment ?? ""}
                                  onChange={(e) => setCommentDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                                  style={{ fontSize: "0.78rem", padding: "4px 6px" }}
                                />
                                <button className="btn secondary" style={{ fontSize: "0.7rem", padding: "4px 6px" }} onClick={() => saveComment(row)}>Save</button>
                                {savedRowId === row.id && <span style={{ color: "var(--good)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>✓ Saved</span>}
                              </div>
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => startEditRow(row)}>Edit</button>{" "}
                              <button className="btn danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => deleteRow(row.id)}>Remove</button>
                            </td>
                          </>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!readOnly && (
          <>
            <div className="grid" style={{ marginTop: 14, gridTemplateColumns: "0.5fr 2fr 0.4fr 0.4fr" }}>
              <div className="field" style={{ position: "relative" }}>
                <label>Item Code</label>
                <input type="text" value={newItemNo} onChange={(e) => onNewItemNoChange(e.target.value)} autoComplete="off" style={{ maxWidth: 130 }} placeholder="optional" />
                {suggestions.length > 0 && (
                  <div style={{ position: "absolute", zIndex: 10, background: "white", border: "1px solid var(--border)", borderRadius: 8, width: "100%", maxHeight: 160, overflowY: "auto" }}>
                    {suggestions.map((s) => (
                      <div key={s.item_no} onClick={() => pickSuggestion(s)} style={{ padding: "8px 10px", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--panel-muted)" }}>
                        <HighlightedCode text={s.item_no} term={newItemNo} /> — {s.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Description</label>
                <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} disabled={newItemKnown} />
              </div>
              <div className="field"><label>Qty</label><input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} /></div>
              <div className="field">
                <label>Unit</label>
                <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} disabled={newItemKnown} />
              </div>
            </div>
            {!newItemNo.trim() && (
              <p className="subtle" style={{ marginTop: -8, marginBottom: 10, fontSize: "0.78rem" }}>
                No item code yet? It'll still be added, automatically flagged N/A so Warehouse knows to chase it down.
              </p>
            )}
            <button className="btn secondary" onClick={addRow} disabled={savingRow}>{savingRow ? "Adding..." : "+ Add item"}</button>
          </>
        )}
      </div>

      <div className="card">
        <h2>Fabrication</h2>

        {fabricationItems.length === 0 ? <p className="subtle" style={{ marginTop: 10 }}>No fabrication items yet.</p> : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="data-table fixed">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "24%" }} />
              </colgroup>
              <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Finish</th><th>Comments</th><th>Photos</th>{!readOnly && <th></th>}</tr></thead>
              <tbody>
                {fabricationItems.map((row) => (
                  <tr key={row.id}>
                    {!readOnly && editingFabRowId === row.id ? (
                      <>
                        <td><input type="text" value={editFabDraft.description} onChange={(e) => setEditFabDraft({ ...editFabDraft, description: e.target.value })} /></td>
                        <td><input type="number" value={editFabDraft.qty} onChange={(e) => setEditFabDraft({ ...editFabDraft, qty: e.target.value })} style={{ width: 60 }} /></td>
                        <td><input type="text" value={editFabDraft.unit} onChange={(e) => setEditFabDraft({ ...editFabDraft, unit: e.target.value })} style={{ width: 55 }} /></td>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={row.status === "finish"} onChange={() => toggleFabFinish(row)} style={{ width: "auto" }} /></td>
                        <td className="subtle">{row.comment || "-"}</td>
                        <td className="subtle">{row.photo_paths.length} photo(s)</td>
                        <td><button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => saveEditFabRow(row.id)}>Save</button></td>
                      </>
                    ) : (
                      <>
                        <td><TruncatedText text={row.description} maxWidth={180} /></td>
                        <td>{row.qty}</td>
                        <td>{row.unit}</td>
                        <td style={{ textAlign: "center" }}>
                          {readOnly ? (
                            row.status === "finish" ? "✓" : ""
                          ) : (
                            <input type="checkbox" checked={row.status === "finish"} onChange={() => toggleFabFinish(row)} style={{ width: "auto" }} />
                          )}
                        </td>
                        {readOnly ? (
                          <td>{row.comment || <span className="subtle">-</span>}</td>
                        ) : (
                          <td>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <input
                                type="text"
                                placeholder="Note for Machine Shop..."
                                value={fabCommentDraft[row.id] ?? row.comment ?? ""}
                                onChange={(e) => setFabCommentDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                                style={{ fontSize: "0.78rem", padding: "4px 6px" }}
                              />
                              <button className="btn secondary" style={{ fontSize: "0.7rem", padding: "4px 6px" }} onClick={() => saveFabComment(row)}>Save</button>
                              {savedFabRowId === row.id && <span style={{ color: "var(--good)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>✓ Saved</span>}
                            </div>
                          </td>
                        )}
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                            {row.photo_paths.map((p, i) => (
                              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <button className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => viewFabPhoto(p)}>Photo{row.photo_paths.length > 1 ? ` ${i + 1}` : ""}</button>
                                {!readOnly && (
                                  <button
                                    className="btn danger" style={{ fontSize: "0.68rem", padding: "2px 5px" }}
                                    title="Remove this photo" onClick={() => deleteFabPhoto(row, p)}
                                  >
                                    ✕
                                  </button>
                                )}
                              </span>
                            ))}
                            {!readOnly && (
                              <input type="file" accept="image/*,application/pdf" multiple style={{ fontSize: "0.7rem" }} onChange={(e) => uploadFabPhotos(row, e.target.files)} />
                            )}
                          </div>
                        </td>
                        {!readOnly && (
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => startEditFabRow(row)}>Edit</button>{" "}
                            <button className="btn danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => deleteFabRow(row.id)}>Remove</button>{" "}
                            <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => printFabricationJo(row)}>Print</button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!readOnly && (
          <>
            <div className="grid" style={{ marginTop: 14, gridTemplateColumns: "2fr 0.5fr 0.5fr" }}>
              <div className="field"><label>Description</label><input type="text" value={newFabDescription} onChange={(e) => setNewFabDescription(e.target.value)} /></div>
              <div className="field"><label>Qty</label><input type="number" value={newFabQty} onChange={(e) => setNewFabQty(e.target.value)} /></div>
              <div className="field"><label>Unit</label><input type="text" value={newFabUnit} onChange={(e) => setNewFabUnit(e.target.value)} /></div>
            </div>
            <button className="btn secondary" onClick={addFabRow} disabled={savingFabRow || !newFabDescription.trim()}>{savingFabRow ? "Adding..." : "+ Add item"}</button>
          </>
        )}
      </div>

      <div className="card">
        <h2>QC Parameter</h2>
        {productionLogs.length === 0 ? <p className="subtle" style={{ marginTop: 10 }}>No station scans yet.</p> : (() => {
          const VISIBLE_UNITS = 3;
          const unitCount = Math.max(1, jobOrder.quantity ?? 1);
          const units = Array.from({ length: unitCount }, (_, i) => i);
          const unitLabel = (unit: number) => jobOrder.serial_numbers?.[unit] || `Unit ${unit + 1}`;
          const rowsForUnit = (unit: number) =>
            productionLogs.flatMap((log) => {
              const results = log.results.filter((r) => (r.unit ?? 0) === unit);
              const rows = results.length > 0 ? results : (log.results.length > 0 ? [] : [{ parameter: "-", actual: "-" }]);
              return rows.map((r, i) => ({ key: `${log.id}-${unit}-${i}`, log, r }));
            });

          return (
            <>
              {units.slice(0, showAllUnitsQc ? units.length : VISIBLE_UNITS).map((unit) => {
                const rows = rowsForUnit(unit);
                return (
                  <div key={unit} style={{ marginTop: 10 }}>
                    {unitCount > 1 && <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 6 }}>{unitLabel(unit)}</div>}
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>Time</th><th>Station</th><th>Parameter</th><th>Actual</th><th>Checked By</th></tr></thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr><td colSpan={5} className="subtle">No station scans yet.</td></tr>
                          ) : rows.map(({ key, log, r }) => (
                            <tr key={key}>
                              <td>{fmtDateTime(log.scanned_at)}</td>
                              <td>{log.station?.station_name ?? "-"}</td>
                              <td>{r.parameter}</td>
                              <td>{r.actual || "-"}</td>
                              <td>{log.account?.full_name ?? log.scanned_by_label ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {units.length > VISIBLE_UNITS && (
                <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => setShowAllUnitsQc((v) => !v)}>
                  {showAllUnitsQc ? "Hide" : `Show remaining ${units.length - VISIBLE_UNITS} unit${units.length - VISIBLE_UNITS > 1 ? "s" : ""}`}
                </button>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}
