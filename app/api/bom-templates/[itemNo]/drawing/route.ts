import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "tempsens-files";

export async function GET(req: Request, { params }: { params: { itemNo: string } }) {
  const admin = getSupabaseAdminClient();
  const { data: template } = await admin
    .from("product_bom_templates")
    .select("drawing_path")
    .eq("item_no", decodeURIComponent(params.itemNo))
    .maybeSingle();

  if (!template?.drawing_path) return NextResponse.json({ error: "No drawing on file." }, { status: 404 });

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(template.drawing_path, 60);
  if (error || !data) return NextResponse.json({ error: error?.message || "Failed to generate link." }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
