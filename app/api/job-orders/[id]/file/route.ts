import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";
const PO_VISIBLE_TABS = ["jo-input", "sales-manager", "operation-manager", "gm"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const type = req.nextUrl.searchParams.get("type");
  const tab = req.nextUrl.searchParams.get("tab");
  if (type !== "drawing" && type !== "po") {
    return NextResponse.json({ error: "Invalid file type." }, { status: 400 });
  }
  if (type === "po" && (!tab || !PO_VISIBLE_TABS.includes(tab))) {
    return NextResponse.json({ error: "Not allowed to view the PO attachment." }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const column = type === "drawing" ? "drawing_path" : "po_attachment_path";
  const { data: jobOrder } = await admin
    .from("job_orders")
    .select("drawing_path, po_attachment_path")
    .eq("id", params.id)
    .maybeSingle();

  if (!jobOrder) return NextResponse.json({ error: "Job order not found." }, { status: 404 });
  const path: string | null = column === "drawing_path" ? jobOrder.drawing_path : jobOrder.po_attachment_path;
  if (!path) return NextResponse.json({ error: "No file uploaded." }, { status: 404 });

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: error?.message || "Failed to generate link." }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl, isPdf: path.toLowerCase().endsWith(".pdf") });
}
