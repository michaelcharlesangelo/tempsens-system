import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

// FormData always (not JSON) so a single call can update fields and append
// photos together - same shape as /api/shipments/[id]. Only fields actually
// present in the payload are touched, so a photo-only upload doesn't blank
// out the rest of the row.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const admin = getSupabaseAdminClient();
  const updates: Record<string, unknown> = {};
  if (formData.has("description")) updates.description = String(formData.get("description") ?? "").trim();
  if (formData.has("qty")) updates.qty = Number(formData.get("qty")) || 0;
  if (formData.has("unit")) updates.unit = String(formData.get("unit") ?? "").trim() || "pcs";
  if (formData.has("comment")) updates.comment = String(formData.get("comment") ?? "").trim();
  if (formData.has("status")) {
    const status = formData.get("status");
    if (status === "production" || status === "finish") updates.status = status;
  }

  const photoFiles = (formData.getAll("photos") as File[]).filter((f) => f && f.size > 0);
  const removePhotoPath = formData.get("removePhoto");
  if (photoFiles.length > 0 || removePhotoPath) {
    const { data: current } = await admin.from("fabrication_items").select("photo_paths").eq("id", params.id).maybeSingle();
    let paths: string[] = current?.photo_paths ?? [];
    if (typeof removePhotoPath === "string" && removePhotoPath) paths = paths.filter((p) => p !== removePhotoPath);
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const ext = file.name.split(".").pop() || "bin";
      const path = `fabrication/${params.id}-${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream", upsert: true,
      });
      if (!upErr) paths.push(path);
    }
    updates.photo_paths = paths;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await admin.from("fabrication_items").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("fabrication_items").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
