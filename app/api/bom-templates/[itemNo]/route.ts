import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { itemNo: string } }) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("product_bom_templates")
    .select("*")
    .eq("item_no", decodeURIComponent(params.itemNo))
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
