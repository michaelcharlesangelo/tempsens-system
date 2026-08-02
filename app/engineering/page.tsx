"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import ComplaintStatusSlider from "@/app/components/ComplaintStatusSlider";
import TruncatedText from "@/app/components/TruncatedText";
import { Complaint, ComplaintStatus, COMPLAINT_STATUSES, complaintMatchesSearch, fmtDate, fmtDateTime } from "@/lib/jobOrders";
import { getCurrentRole } from "@/lib/roles";

// Engineering's own page - separate from the read-mostly Complaints table.
// Engineering can't submit complaints (no +New here), but owns the status/
// progress lifecycle: clicking a complaint's status opens the Not Done /
// In Progress / Done picker + a comment box, and Save writes one combined
// history entry - same pattern as PO Out's Exim page.
function EngineeringTable({
  items, title, historyItems, historyTitle,
  updatesOpenId, setUpdatesOpenId, statusDraft, setStatusDraft, commentDraft, setCommentDraft,
  saveUpdate, savingId, photoFiles, setPhotoFiles, photoInputKey, uploadingPhotosId, uploadPhotos, viewPhoto,
  finishing, finishComplaint,
}: {
  items: Complaint[]; title: string; historyItems: Complaint[]; historyTitle: string;
  updatesOpenId: string | null; setUpdatesOpenId: (id: string | null) => void;
  statusDraft: Record<string, ComplaintStatus>; setStatusDraft: (fn: (cur: Record<string, ComplaintStatus>) => Record<string, ComplaintStatus>) => void;
  commentDraft: Record<string, string>; setCommentDraft: (fn: (cur: Record<string, string>) => Record<string, string>) => void;
  saveUpdate: (c: Complaint) => void; savingId: string | null;
  photoFiles: Record<string, File[]>; setPhotoFiles: (fn: (cur: Record<string, File[]>) => Record<string, File[]>) => void;
  photoInputKey: Record<string, number>;
  uploadingPhotosId: string | null; uploadPhotos: (c: Complaint) => void; viewPhoto: (path: string) => void;
  finishing: string | null; finishComplaint: (c: Complaint) => void;
}) {
  const [open, setOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, complaintMatchesSearch);
  const historyPaged = usePagedSearch(historyItems, complaintMatchesSearch);

  function renderRow(c: Complaint, editable: boolean) {
    const meta = COMPLAINT_STATUSES.find((s) => s.value === c.status)!;
    return (
      <Fragment key={c.id}>
        <tr>
          <td>{fmtDate(c.created_at)}</td>
          <td>{c.customer_name}</td>
          <td>{c.so_no}</td>
          <td><TruncatedText text={c.item_description} /></td>
          <td>{c.quantity}</td>
          <td style={{ maxWidth: 180 }}>{c.problem_description}</td>
          <td>
            {c.photo_paths.length === 0 ? <span className="subtle">-</span> : c.photo_paths.map((p, i) => (
              <button key={i} className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 6px", marginRight: 4 }} onClick={() => viewPhoto(p)}>View{c.photo_paths.length > 1 ? ` ${i + 1}` : ""}</button>
            ))}
          </td>
          <td>
            {(c.engineering_photo_paths ?? []).length === 0 ? <span className="subtle">-</span> : (c.engineering_photo_paths ?? []).map((p, i) => (
              <button key={i} className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 6px", marginRight: 4 }} onClick={() => viewPhoto(p)}>View{(c.engineering_photo_paths ?? []).length > 1 ? ` ${i + 1}` : ""}</button>
            ))}
          </td>
          <td>
            <span
              className="pill" style={{ background: meta.color, color: "white", cursor: editable ? "pointer" : "default" }}
              onClick={() => editable && setUpdatesOpenId(updatesOpenId === c.id ? null : c.id)}
            >
              {meta.label}
            </span>
          </td>
        </tr>
        {editable && updatesOpenId === c.id && (
          <tr>
            <td colSpan={8} style={{ background: "var(--panel-muted)" }}>
              <div style={{ padding: "8px 2px" }}>
                <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Update progress</div>
                <ComplaintStatusSlider status={statusDraft[c.id] ?? c.status} onChange={(s) => setStatusDraft((cur) => ({ ...cur, [c.id]: s }))} />
                <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 520, flexWrap: "wrap" }}>
                  <input
                    type="text" placeholder="Comment"
                    value={commentDraft[c.id] ?? ""} onChange={(e) => setCommentDraft((cur) => ({ ...cur, [c.id]: e.target.value })) }
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button className="btn secondary" disabled={savingId === c.id} onClick={() => saveUpdate(c)}>
                    {savingId === c.id ? "Saving..." : "Save"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <label className="subtle" style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Photos</label>
                  <input
                    key={photoInputKey[c.id] ?? 0}
                    type="file" multiple accept="image/*,application/pdf"
                    onChange={(e) => setPhotoFiles((cur) => ({ ...cur, [c.id]: Array.from(e.target.files || []) }))}
                  />
                  <button className="btn secondary" style={{ fontSize: "0.75rem" }} disabled={uploadingPhotosId === c.id || !(photoFiles[c.id] ?? []).length} onClick={() => uploadPhotos(c)}>
                    {uploadingPhotosId === c.id ? "Uploading..." : "Upload"}
                  </button>
                </div>
                {c.status === "done" && (
                  <div style={{ marginTop: 10 }}>
                    <button className="btn" disabled={finishing === c.id} onClick={() => finishComplaint(c)}>
                      {finishing === c.id ? "Finishing..." : "Finish — move to History"}
                    </button>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  {c.history.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No updates yet.</p> : c.history.map((h) => (
                    <div key={h.id} style={{ fontSize: "0.82rem", padding: "3px 0" }}>
                      <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                    </div>
                  ))}
                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpen((v) => !v)}>
          <span style={{ display: "inline-block", fontSize: "0.75em", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
          {title} ({items.length})
        </h2>
        <button className="btn secondary" onClick={() => setHistoryOpen((v) => !v)}>
          {historyOpen ? "Hide History" : `History (${historyItems.length})`}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {items.length === 0 ? <p className="subtle">None.</p> : (
            <>
              <SearchBox value={search} onChange={setSearch} />
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Photos Update</th><th>Status</th></tr>
                  </thead>
                  <tbody>{pageItems.map((c) => renderRow(c, true))}</tbody>
                </table>
              </div>
              <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
            </>
          )}
        </div>
      )}

      {historyOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 8px" }}>{historyTitle} ({historyItems.length})</h3>
          {historyItems.length === 0 ? <p className="subtle">None yet.</p> : (
            <>
              <SearchBox value={historyPaged.search} onChange={historyPaged.setSearch} />
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Photos Update</th><th>Status</th></tr>
                  </thead>
                  <tbody>{historyPaged.pageItems.map((c) => renderRow(c, false))}</tbody>
                </table>
              </div>
              <Pager page={historyPaged.page} totalPages={historyPaged.totalPages} totalCount={historyPaged.totalCount} onChange={historyPaged.setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function EngineeringPage() {
  const currentRole = getCurrentRole();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [updatesOpenId, setUpdatesOpenId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<Record<string, ComplaintStatus>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<Record<string, File[]>>({});
  const [photoInputKey, setPhotoInputKey] = useState<Record<string, number>>({});
  const [uploadingPhotosId, setUploadingPhotosId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/complaints", { cache: "no-store" });
    const data = await res.json();
    setComplaints(data.complaints ?? []);
  }

  useEffect(() => { load(); }, []);

  async function viewPhoto(path: string) {
    const res = await fetch(`/api/complaints/x/photo?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  async function saveUpdate(c: Complaint) {
    const status = statusDraft[c.id] ?? c.status;
    const comment = (commentDraft[c.id] ?? "").trim();
    setSavingId(c.id);
    try {
      const res = await fetch(`/api/complaints/${c.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setStatus", status, comment, changedBy: currentRole.label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMessage(data.error || "Failed to save update."); return; }
      setCommentDraft((cur) => ({ ...cur, [c.id]: "" }));
      load();
    } finally {
      setSavingId(null);
    }
  }

  async function uploadPhotos(c: Complaint) {
    const files = photoFiles[c.id] ?? [];
    if (files.length === 0) return;
    setUploadingPhotosId(c.id);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("photos", f));
      const res = await fetch(`/api/complaints/${c.id}/photos`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMessage(data.error || "Failed to upload photos."); return; }
      setPhotoFiles((cur) => ({ ...cur, [c.id]: [] }));
      setPhotoInputKey((cur) => ({ ...cur, [c.id]: (cur[c.id] ?? 0) + 1 }));
      load();
    } finally {
      setUploadingPhotosId(null);
    }
  }

  async function finishComplaint(c: Complaint) {
    if (!confirm(`Mark this complaint (SO ${c.so_no}) as finished? It will move to History.`)) return;
    setFinishing(c.id);
    try {
      const res = await fetch(`/api/complaints/${c.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMessage(data.error || "Failed to move this complaint to History."); return; }
      setUpdatesOpenId(null);
      load();
    } finally {
      setFinishing(null);
    }
  }

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  function isExpired(c: Complaint): boolean {
    return c.status === "done" && !!c.resolved_at && Date.now() - new Date(c.resolved_at).getTime() > SEVEN_DAYS_MS;
  }

  const visible = (complaints ?? []).filter((c) => !c.archived && !isExpired(c));
  const history = (complaints ?? []).filter((c) => c.archived || isExpired(c));

  const indonesia = visible.filter((c) => !c.is_traded);
  const traded = visible.filter((c) => c.is_traded);
  const historyIndonesia = history.filter((c) => !c.is_traded);
  const historyTraded = history.filter((c) => c.is_traded);

  const sharedProps = {
    updatesOpenId, setUpdatesOpenId, statusDraft, setStatusDraft, commentDraft, setCommentDraft,
    saveUpdate, savingId, photoFiles, setPhotoFiles, photoInputKey, uploadingPhotosId, uploadPhotos, viewPhoto, finishing, finishComplaint,
  };

  return (
    <>
      {message && <div className="warn">{message}</div>}

      {!complaints ? <p className="subtle">Loading...</p> : (
        <>
          <EngineeringTable
            items={indonesia} title="Complaints — Tempsens Indonesia"
            historyItems={historyIndonesia} historyTitle="History — Tempsens Indonesia"
            {...sharedProps}
          />
          <EngineeringTable
            items={traded} title="Complaints — Traded Item"
            historyItems={historyTraded} historyTitle="History — Traded Item"
            {...sharedProps}
          />
        </>
      )}
    </>
  );
}
