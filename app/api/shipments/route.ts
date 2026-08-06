import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("shipments")
    .select("*, history:shipment_history(*)")
    .order("created_at", { ascending: false })
    .order("changed_at", { foreignTable: "shipment_history", ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shipments: data });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const submittedBy = ((formData.get("submittedBy") as string) || "").trim();

  const row: Record<string, unknown> = {
    shipment_number: ((formData.get("shipmentNumber") as string) || "").trim(),
    supplier: ((formData.get("supplier") as string) || "").trim(),
    shipment_via: ((formData.get("shipmentVia") as string) || "").trim(),
    incoterms: ((formData.get("incoterms") as string) || "").trim(),
    invoice: ((formData.get("invoice") as string) || "").trim(),
    awb_bl: ((formData.get("awbBl") as string) || "").trim(),
    atd: (formData.get("atd") as string) || null,
    eta_jkt: (formData.get("etaJkt") as string) || null,
    sppb: ((formData.get("sppb") as string) || "").trim(),
    delivery: ((formData.get("delivery") as string) || "").trim(),
    submitted_by: submittedBy,
  };

  const admin = getSupabaseAdminClient();

  const awbBlFile = formData.get("awbBlFile") as File | null;
  if (awbBlFile && awbBlFile.size > 0) {
    const ext = awbBlFile.name.split(".").pop() || "bin";
    const path = `shipments/${Date.now()}-awbbl.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, awbBlFile, {
      contentType: awbBlFile.type || "application/octet-stream", upsert: true,
    });
    if (!upErr) { row.awb_bl_file_path = path; row.awb_bl_file_name = awbBlFile.name; }
  }

  const photoFiles = formData.getAll("photos") as File[];
  const photoPaths: string[] = [];
  for (let i = 0; i < photoFiles.length; i++) {
    const file = photoFiles[i];
    if (!file || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "bin";
    const path = `shipments/${Date.now()}-photo-${i}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream", upsert: true,
    });
    if (!upErr) photoPaths.push(path);
  }
  row.photo_paths = photoPaths;

  const { data, error } = await admin.from("shipments").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shipment: data });
}
