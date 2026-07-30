import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const admin = getSupabaseAdminClient();

  const updates: Record<string, unknown> = {
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
  };

  const awbBlFile = formData.get("awbBlFile") as File | null;
  if (awbBlFile && awbBlFile.size > 0) {
    const ext = awbBlFile.name.split(".").pop() || "bin";
    const path = `shipments/${params.id}-${Date.now()}-awbbl.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, awbBlFile, {
      contentType: awbBlFile.type || "application/octet-stream", upsert: true,
    });
    if (!upErr) { updates.awb_bl_file_path = path; updates.awb_bl_file_name = awbBlFile.name; }
  }

  const photoFiles = (formData.getAll("photos") as File[]).filter((f) => f && f.size > 0);
  if (photoFiles.length > 0) {
    const { data: current } = await admin.from("shipments").select("photo_paths").eq("id", params.id).maybeSingle();
    const existing: string[] = current?.photo_paths ?? [];
    const newPaths: string[] = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const ext = file.name.split(".").pop() || "bin";
      const path = `shipments/${params.id}-${Date.now()}-photo-${i}.${ext}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream", upsert: true,
      });
      if (!upErr) newPaths.push(path);
    }
    updates.photo_paths = [...existing, ...newPaths];
  }

  const { data, error } = await admin.from("shipments").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shipment: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("shipments").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
