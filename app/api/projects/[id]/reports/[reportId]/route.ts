import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

// FormData (not JSON) so a single call can update text fields, append new
// photos, and remove one existing photo together - same shape as
// /api/fabrication/[id]. Only Project Manager's own page exposes this.
export async function PATCH(req: NextRequest, { params }: { params: { reportId: string } }) {
  const formData = await req.formData();
  const admin = getSupabaseAdminClient();
  const updates: Record<string, unknown> = {};
  if (formData.has("report")) updates.report = String(formData.get("report") ?? "").trim();
  if (formData.has("nextStep")) updates.next_step = String(formData.get("nextStep") ?? "").trim();

  const photoFiles = (formData.getAll("photos") as File[]).filter((f) => f && f.size > 0);
  const removePhotoPath = formData.get("removePhoto");
  if (photoFiles.length > 0 || removePhotoPath) {
    const { data: current } = await admin.from("project_reports").select("photo_paths").eq("id", params.reportId).maybeSingle();
    let paths: string[] = current?.photo_paths ?? [];
    if (typeof removePhotoPath === "string" && removePhotoPath) paths = paths.filter((p) => p !== removePhotoPath);
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const ext = file.name.split(".").pop() || "bin";
      const path = `projects/${params.reportId}-${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream", upsert: true,
      });
      if (!upErr) paths.push(path);
    }
    updates.photo_paths = paths;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await admin.from("project_reports").update(updates).eq("id", params.reportId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { reportId: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("project_reports").delete().eq("id", params.reportId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
