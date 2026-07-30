import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TAB_CATEGORIES = ["TEMPSENS", "ALLEIMA", "OTHER_INDIA", "OTHER_IMPORT", "LOCAL", "EXPORT", "STOCK_TAJ"];

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("suppliers").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suppliers: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().toUpperCase() : "";
  const tabCategory = TAB_CATEGORIES.includes(body.tabCategory) ? body.tabCategory : "OTHER_IMPORT";
  if (!name) return NextResponse.json({ error: "Supplier name is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("suppliers").insert({ name, tab_category: tabCategory }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ supplier: data });
}
