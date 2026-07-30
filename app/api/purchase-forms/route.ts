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
}

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("purchase_forms")
    .select("*, items:purchase_form_items(*)")
    .order("created_at", { ascending: false })
    .order("seq", { foreignTable: "purchase_form_items", ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ forms: data });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const formType = formData.get("formType") === "B" ? "B" : "A";
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

  const admin = getSupabaseAdminClient();
  const { data: form, error: formError } = await admin
    .from("purchase_forms")
    .insert({ form_type: formType, request_date: requestDate, name, customer_name: customerName, po_so_number: poSoNumber, purpose })
    .select()
    .single();
  if (formError) return NextResponse.json({ error: formError.message }, { status: 500 });

  const rows = await Promise.all(items.map(async (item, i) => {
    let attachmentPath: string | null = null;
    let attachmentFilename: string | null = null;
    const file = formData.get(`attachment_${i}`) as File | null;
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `purchase-forms/${form.id}/${i}-${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      if (!upErr) { attachmentPath = path; attachmentFilename = file.name; }
    }
    return {
      purchase_form_id: form.id,
      seq: i,
      description: String(item.description ?? "").trim(),
      budget: Number(item.budget) || 0,
      ppn: !!item.ppn,
      supplier_name: String(item.supplierName ?? "").trim(),
      code: String(item.code ?? "").trim(),
      attachment_path: attachmentPath,
      attachment_filename: attachmentFilename,
    };
  }));

  const { error: itemsError } = await admin.from("purchase_form_items").insert(rows);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  return NextResponse.json({ ok: true, formId: form.id });
}
