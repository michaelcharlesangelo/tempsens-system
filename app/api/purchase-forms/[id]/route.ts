import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

interface ItemInput {
  description?: string;
  budget?: number | string;
  ppn?: boolean;
  supplierName?: string;
  code?: string;
  existingPath?: string | null;
  existingFilename?: string | null;
  itemCode?: string;
  qty?: number | string;
  unit?: string;
  remarks?: string;
}

const FORM_TYPES = ["A", "B", "C", "D"];

// Editing is only allowed while still pending_approval - same rule as
// Sales Support editing a JO before it's moved past their control.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin.from("purchase_forms").select("status").eq("id", params.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Form not found." }, { status: 404 });
  if (existing.status !== "pending_approval") {
    return NextResponse.json({ error: `Can't edit a form that's "${existing.status}".` }, { status: 400 });
  }

  const formData = await req.formData();
  const formTypeRaw = formData.get("formType") as string;
  const formType = FORM_TYPES.includes(formTypeRaw) ? formTypeRaw : "A";
  const requestDate = (formData.get("requestDate") as string) || new Date().toISOString().slice(0, 10);
  const name = ((formData.get("name") as string) || "").trim();
  const customerName = ((formData.get("customerName") as string) || "").trim();
  const poSoNumber = ((formData.get("poSoNumber") as string) || "").trim();
  const purpose = ((formData.get("purpose") as string) || "").trim();

  let items: ItemInput[] = [];
  try {
    items = JSON.parse((formData.get("items") as string) || "[]");
  } catch {
    return NextResponse.json({ error: "Invalid items payload." }, { status: 400 });
  }
  if (!name || items.length === 0) {
    return NextResponse.json({ error: "Name and at least one item are required." }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from("purchase_forms")
    .update({ form_type: formType, request_date: requestDate, name, customer_name: customerName, po_so_number: poSoNumber, purpose })
    .eq("id", params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const rows = await Promise.all(items.map(async (item, i) => {
    let attachmentPath: string | null = item.existingPath ?? null;
    let attachmentFilename: string | null = item.existingFilename ?? null;
    const file = formData.get(`attachment_${i}`) as File | null;
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `purchase-forms/${params.id}/${i}-${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      if (!upErr) { attachmentPath = path; attachmentFilename = file.name; }
    }
    return {
      purchase_form_id: params.id,
      seq: i,
      description: String(item.description ?? "").trim(),
      budget: Number(item.budget) || 0,
      ppn: !!item.ppn,
      supplier_name: String(item.supplierName ?? "").trim(),
      code: String(item.code ?? "").trim(),
      attachment_path: attachmentPath,
      attachment_filename: attachmentFilename,
      item_code: String(item.itemCode ?? "").trim().toUpperCase(),
      qty: Number(item.qty) || 0,
      unit: String(item.unit ?? "").trim(),
      remarks: String(item.remarks ?? "").trim(),
    };
  }));

  const { error: delError } = await admin.from("purchase_form_items").delete().eq("purchase_form_id", params.id);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
  const { error: insError } = await admin.from("purchase_form_items").insert(rows);
  if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
