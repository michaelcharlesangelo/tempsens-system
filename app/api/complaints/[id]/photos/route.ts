import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

// Engineering attaches its own photos (e.g. proof of fix) on top of
// whatever the original submitter attached - appends, never replaces.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const photos = formData.getAll("photos") as File[];
  if (photos.length === 0) return NextResponse.json({ error: "No photos provided." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data: current } = await admin.from("complaints").select("photo_paths").eq("id", params.id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Complaint not found." }, { status: 404 });

  const newPaths: string[] = [];
  for (const file of photos) {
    if (!file || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "bin";
    const path = `complaints/${params.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream", upsert: true,
    });
    if (!upErr) newPaths.push(path);
  }

  const photoPaths = [...(current.photo_paths ?? []), ...newPaths];
  const { data, error } = await admin.from("complaints").update({ photo_paths: photoPaths }).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ complaint: data });
}
