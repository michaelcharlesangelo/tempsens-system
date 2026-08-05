import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const admin = getSupabaseAdminClient();

  const progressId = (formData.get("progressId") as string) || null;
  const row: Record<string, unknown> = {
    project_id: params.id,
    progress_id: progressId,
    report: ((formData.get("report") as string) || "").trim(),
    next_step: ((formData.get("nextStep") as string) || "").trim(),
    submitted_by: ((formData.get("submittedBy") as string) || "").trim(),
  };

  const photoFiles = formData.getAll("photos") as File[];
  const photoPaths: string[] = [];
  for (let i = 0; i < photoFiles.length; i++) {
    const file = photoFiles[i];
    if (!file || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "bin";
    const path = `projects/${params.id}-${Date.now()}-${i}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream", upsert: true,
    });
    if (!upErr) photoPaths.push(path);
  }
  row.photo_paths = photoPaths;

  const { data, error } = await admin.from("project_reports").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}
