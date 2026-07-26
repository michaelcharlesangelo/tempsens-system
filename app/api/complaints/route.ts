import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("complaints").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ complaints: data });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const customerName = (formData.get("customerName") as string || "").trim();
  const poNumber = (formData.get("poNumber") as string || "").trim();
  const itemDescription = (formData.get("itemDescription") as string || "").trim();
  const quantity = Number(formData.get("quantity")) || 1;
  const isTraded = formData.get("isTraded") === "true";
  const problemDescription = (formData.get("problemDescription") as string || "").trim();
  const submittedBy = (formData.get("submittedBy") as string || "").trim();
  const photos = formData.getAll("photos") as File[];

  if (!customerName) return NextResponse.json({ error: "Customer name is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data: complaint, error } = await admin
    .from("complaints")
    .insert({
      customer_name: customerName,
      po_number: poNumber,
      item_description: itemDescription,
      quantity,
      is_traded: isTraded,
      problem_description: problemDescription,
      submitted_by: submittedBy,
      status: "not_done",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paths: string[] = [];
  for (const file of photos) {
    if (!file || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "bin";
    const path = `complaints/${complaint.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
    if (!upErr) paths.push(path);
  }

  let finalComplaint = complaint;
  if (paths.length > 0) {
    const { data: updated } = await admin.from("complaints").update({ photo_paths: paths }).eq("id", complaint.id).select().single();
    if (updated) finalComplaint = updated;
  }

  return NextResponse.json({ complaint: finalComplaint });
}
