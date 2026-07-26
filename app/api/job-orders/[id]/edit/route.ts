import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";
// Editable only before it's cleared General Manager approval - matches the
// Sales Support "Edit" button visibility rule.
const EDITABLE_STATUSES = ["draft", "pending_approval"];

// Field label + comparable value, used to build a human-readable diff for
// the change log ("Qty changed from 10 to 15").
const TRACKED_FIELDS: { key: string; label: string }[] = [
  { key: "customer_name", label: "Customer Name" },
  { key: "so_no", label: "SO Number" },
  { key: "item_category", label: "Category" },
  { key: "item_description", label: "Item Description" },
  { key: "quantity", label: "Qty" },
  { key: "item_no", label: "Item Code" },
  { key: "sales_person_name", label: "Sales" },
  { key: "deadline", label: "Deadline" },
  { key: "urgent", label: "Urgent" },
  { key: "drawing_number", label: "Drawing Number" },
];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin.from("job_orders").select("*").eq("id", params.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Job order not found." }, { status: 404 });
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    return NextResponse.json({ error: `This job order can no longer be edited (status: ${existing.status}).` }, { status: 400 });
  }

  const formData = await req.formData();
  const customerName = (formData.get("customerName") as string || "").trim();
  const soNo = (formData.get("soNo") as string || "").trim();
  const itemCategory = (formData.get("itemCategory") as string || "").trim();
  const itemDescription = (formData.get("itemDescription") as string || "").trim();
  const quantity = Number(formData.get("quantity")) || 1;
  const itemNo = (formData.get("itemNo") as string || "").trim();
  const salesPersonName = (formData.get("salesPersonName") as string || "").trim();
  const salesSupportName = (formData.get("salesSupportName") as string || "").trim();
  const deadlineRaw = formData.get("deadline") as string | null;
  const deadline = deadlineRaw && deadlineRaw.length > 0 ? deadlineRaw : null;
  const urgent = formData.get("urgent") === "true";
  const drawingNumber = (formData.get("drawingNumber") as string || "").trim();
  const drawingFile = formData.get("drawing") as File | null;
  const poFile = formData.get("po") as File | null;

  if (!customerName) {
    return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    customer_name: customerName,
    so_no: soNo,
    item_category: itemCategory,
    item_description: itemDescription,
    quantity,
    item_no: itemNo,
    sales_person_name: salesPersonName,
    sales_support_name: salesSupportName || existing.sales_support_name,
    deadline,
    urgent,
    drawing_number: drawingNumber,
  };

  // Build the "what changed" summary before overwriting anything.
  const changeLines: string[] = [];
  for (const { key, label } of TRACKED_FIELDS) {
    const before = existing[key];
    const after = updates[key];
    const beforeStr = before === null || before === undefined ? "-" : String(before);
    const afterStr = after === null || after === undefined ? "-" : String(after);
    if (beforeStr !== afterStr) changeLines.push(`${label}: "${beforeStr}" → "${afterStr}"`);
  }
  if (drawingFile && drawingFile.size > 0) changeLines.push("Drawing file replaced");
  if (poFile && poFile.size > 0) changeLines.push("PO attachment replaced");

  if (drawingFile && drawingFile.size > 0) {
    const ext = drawingFile.name.split(".").pop() || "bin";
    const path = `${params.id}/drawing-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, drawingFile, {
      contentType: drawingFile.type || "application/octet-stream",
      upsert: true,
    });
    if (!upErr) updates.drawing_path = path;
  }

  if (poFile && poFile.size > 0) {
    const ext = poFile.name.split(".").pop() || "bin";
    const path = `${params.id}/po-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, poFile, {
      contentType: poFile.type || "application/octet-stream",
      upsert: true,
    });
    if (!upErr) updates.po_attachment_path = path;
  }

  const { data, error } = await admin.from("job_orders").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (itemNo) {
    await admin
      .from("item_catalog")
      .upsert({ item_no: itemNo, description: itemDescription, category: itemCategory, kind: "finished" }, { onConflict: "item_no" });
  }

  if (changeLines.length > 0) {
    await admin.from("job_order_history").insert({
      job_order_id: params.id,
      status: existing.status,
      changed_by: salesSupportName || existing.sales_support_name || "Sales Support",
      comment: `Edited — ${changeLines.join("; ")}`,
    });
  }

  return NextResponse.json({ jobOrder: data });
}
