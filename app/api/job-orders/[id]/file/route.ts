import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { PO_VISIBLE_ROLES } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "job-order-files";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");
  if (type !== "drawing" && type !== "po") {
    return NextResponse.json({ error: "Invalid file type." }, { status: 400 });
  }
  if (type === "po" && !PO_VISIBLE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "You're not allowed to view the PO attachment." }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data: jobOrder } = await admin
    .from("job_orders")
    .select("drawing_url, po_attachment_url")
    .eq("id", params.id)
    .maybeSingle();

  if (!jobOrder) return NextResponse.json({ error: "Job order not found." }, { status: 404 });

  const path: string | null = type === "drawing" ? jobOrder.drawing_url : jobOrder.po_attachment_url;

  if (!path) return NextResponse.json({ error: "No file uploaded." }, { status: 404 });

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: error?.message || "Failed to generate link." }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl });
}
