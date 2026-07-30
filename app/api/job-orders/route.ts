import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { generateJoNumber, generateShortCode, JobOrder } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";
const PO_VISIBLE_TABS = ["jo-input", "sales-support-supervisor", "sales-manager", "operational-manager", "general-manager"];

function stripPoIfUnauthorized(jo: JobOrder, tab: string | null): JobOrder {
  if (tab && PO_VISIBLE_TABS.includes(tab)) return jo;
  return { ...jo, po_attachment_path: undefined };
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const tab = req.nextUrl.searchParams.get("tab");
  const barcode = req.nextUrl.searchParams.get("barcode");
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("job_orders")
    .select("*, history:job_order_history(id, job_order_id, status, changed_by, comment, changed_at)")
    .order("created_at", { ascending: false })
    .order("changed_at", { foreignTable: "job_order_history", ascending: true });
  if (status) query = query.eq("status", status);
  if (barcode) query = query.eq("barcode", barcode.trim());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobOrdersRaw = data as JobOrder[];

  // Live "has Warehouse Manager prepared everything" flag - not just a
  // snapshot from when the job order last flipped to in_progress, since
  // Production Manager can add new BOM rows afterward that reset this.
  const jobOrderIds = jobOrdersRaw.map((jo) => jo.id);
  const materialPreparedMap = new Map<string, boolean>();
  if (jobOrderIds.length > 0) {
    const { data: bomRows } = await admin
      .from("job_order_bom")
      .select("job_order_id, material_ready, material_prepared")
      .in("job_order_id", jobOrderIds);
    const byJo = new Map<string, { material_ready: boolean; material_prepared: boolean }[]>();
    for (const row of (bomRows ?? []) as { job_order_id: string; material_ready: boolean; material_prepared: boolean }[]) {
      const list = byJo.get(row.job_order_id) ?? [];
      list.push(row);
      byJo.set(row.job_order_id, list);
    }
    for (const id of jobOrderIds) {
      // A Not Available row (material_ready: false) must count against
      // "everything's ready" too, not be silently excluded - otherwise
      // adding a new N/A item to an already-ready JO left the stage pill
      // stuck on "Material Ready" instead of reverting to "Preparing".
      const rows = byJo.get(id) ?? [];
      materialPreparedMap.set(id, rows.length > 0 && rows.every((r) => r.material_ready && r.material_prepared));
    }
  }

  const jobOrders = jobOrdersRaw.map((jo) => ({
    ...stripPoIfUnauthorized(jo, tab),
    material_prepared_all: materialPreparedMap.get(jo.id) ?? false,
  }));
  return NextResponse.json({ jobOrders });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const customerName = (formData.get("customerName") as string || "").trim();
  const soNo = (formData.get("soNo") as string || "").trim().toUpperCase();
  const itemCategory = (formData.get("itemCategory") as string || "").trim();
  const itemDescription = (formData.get("itemDescription") as string || "").trim();
  const quantity = Number(formData.get("quantity")) || 1;
  const itemNo = (formData.get("itemNo") as string || "").trim().toUpperCase();
  const salesPersonName = (formData.get("salesPersonName") as string || "").trim();
  const salesSupportName = (formData.get("salesSupportName") as string || "").trim();
  const salesSupportAccountId = (formData.get("salesSupportAccountId") as string || "").trim() || null;
  const deadlineRaw = formData.get("deadline") as string | null;
  const deadline = deadlineRaw && deadlineRaw.length > 0 ? deadlineRaw : null;
  const urgent = formData.get("urgent") === "true";
  const drawingNumber = (formData.get("drawingNumber") as string || "").trim().toUpperCase();
  const drawingFile = formData.get("drawing") as File | null;
  const poFile = formData.get("po") as File | null;

  if (!customerName || !soNo || !itemDescription || !itemCategory || !itemNo) {
    return NextResponse.json({ error: "Customer Name, SO Number, Item Description, Category, and Item Code are required." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { count } = await admin
    .from("job_orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", yearStart);

  const autoJoNumber = generateJoNumber(count ?? 0);
  const requestedJoNumber = soNo || autoJoNumber;

  let { data, error } = await admin
    .from("job_orders")
    .insert({
      jo_number: requestedJoNumber,
      customer_name: customerName,
      so_no: soNo,
      item_category: itemCategory,
      item_description: itemDescription,
      quantity,
      item_no: itemNo,
      sales_person_name: salesPersonName,
      sales_support_name: salesSupportName,
      sales_support_account_id: salesSupportAccountId,
      deadline,
      urgent,
      drawing_number: drawingNumber,
      barcode: generateShortCode(),
      status: "pending_approval",
      current_approval_layer: 1,
    })
    .select()
    .single();

  // SO number already used for another job order - fall back to the
  // auto-generated number instead of failing outright.
  if (error && error.code === "23505") {
    const retry = await admin
      .from("job_orders")
      .insert({
        jo_number: autoJoNumber,
        customer_name: customerName,
        so_no: soNo,
        item_category: itemCategory,
        item_description: itemDescription,
        quantity,
        item_no: itemNo,
        sales_person_name: salesPersonName,
        sales_support_name: salesSupportName,
        deadline,
        urgent,
        drawing_number: drawingNumber,
        barcode: generateShortCode(),
        status: "pending_approval",
        current_approval_layer: 1,
      })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updates: Record<string, string> = {};

  if (drawingFile && drawingFile.size > 0) {
    const ext = drawingFile.name.split(".").pop() || "bin";
    const path = `${data.id}/drawing-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, drawingFile, {
      contentType: drawingFile.type || "application/octet-stream",
      upsert: true,
    });
    if (!upErr) { updates.drawing_path = path; updates.drawing_filename = drawingFile.name; }
  }

  if (poFile && poFile.size > 0) {
    const ext = poFile.name.split(".").pop() || "bin";
    const path = `${data.id}/po-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, poFile, {
      contentType: poFile.type || "application/octet-stream",
      upsert: true,
    });
    if (!upErr) { updates.po_attachment_path = path; updates.po_attachment_filename = poFile.name; }
  }

  let finalJobOrder = data;
  if (Object.keys(updates).length > 0) {
    const { data: updatedJo } = await admin.from("job_orders").update(updates).eq("id", data.id).select().single();
    if (updatedJo) finalJobOrder = updatedJo;
  }

  if (itemNo) {
    await admin
      .from("item_catalog")
      .upsert({ item_no: itemNo, description: itemDescription, category: itemCategory, kind: "finished" }, { onConflict: "item_no" });
  }

  await admin.from("job_order_history").insert({
    job_order_id: data.id,
    status: "pending_approval (layer 1)",
    changed_by: salesSupportName || "Sales Support",
    comment: "Job order created and submitted for approval.",
  });

  return NextResponse.json({ jobOrder: finalJobOrder });
}
