import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { PO_VISIBLE_ROLES } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "job-order-files";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (type !== "drawing" && type !== "po") {
    return NextResponse.json({ error: "Invalid file type." }, { status: 400 });
  }
  if (type === "po" && !PO_VISIBLE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "You're not allowed to upload the PO attachment." }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${params.id}/${type}-${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const column = type === "drawing" ? "drawing_url" : "po_attachment_url";
  const { error: updateError } = await admin.from("job_orders").update({ [column]: path }).eq("id", params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, path });
}
