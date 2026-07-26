import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { generateJoNumber, generateShortCode, JobOrder } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";
const PO_VISIBLE_TABS = ["jo-input", "sales-manager", "operation-manager", "gm"];

function stripPoIfUnauthorized(jo: JobOrder, tab: string | null): JobOrder {
  if (tab && PO_VISIBLE_TABS.includes(tab)) return jo;
  return { ...jo, po_attachment_path: undefined };
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const tab = req.nextUrl.searchParams.get("tab");
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("job_orders")
    .select("*, history:job_order_history(id, job_order_id, status, changed_by, comment, changed_at)")
    .order("created_at", { ascending: false })
    .order("changed_at", { foreignTable: "job_order_history", ascending: true });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobOrders = (data as JobOrder[]).map((jo) => stripPoIfUnauthorized(jo, tab));
  return NextResponse.json({ jobOrders });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const customerName = (formData.get("customerName") as string || "").trim();
  const soNo = (formData.get("soNo") as string || "").trim();
  const itemCategory = (formData.get("itemCategory") as string || "").trim();
  const itemDescription = (formData.get("itemDescription") as string || "").trim();
  const quantity = Number(formData.get("quantity")) || 1;
  const itemNo = (formData.get("itemNo") as string || "").trim();
  const salesPersonName = (formData.get("salesPersonName") as string || "").trim();
  const deadlineRaw = formData.get("deadline") as string | null;
  const deadline = deadlineRaw && deadlineRaw.length > 0 ? deadlineRaw : null;
  const urgent = formData.get("urgent") === "true";
  const drawingNumber = (formData.get("drawingNumber") as string || "").trim();
  const drawingFile = formData.get("drawing") as File | null;
  const poFile = formData.get("po") as File | null;

  if (!customerName) {
    return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
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
    if (!upErr) updates.drawing_path = path;
  }

  if (poFile && poFile.size > 0) {
    const ext = poFile.name.split(".").pop() || "bin";
    const path = `${data.id}/po-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, poFile, {
      contentType: poFile.type || "application/octet-stream",
      upsert: true,
    });
    if (!upErr) updates.po_attachment_path = path;
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
    changed_by: salesPersonName || "Sales Support",
    comment: "Job order created and submitted for approval.",
  });

  return NextResponse.json({ jobOrder: finalJobOrder });
}
