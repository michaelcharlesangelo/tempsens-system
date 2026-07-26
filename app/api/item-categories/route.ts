import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("item_categories").select("*").order("sequence");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const isTraded = Boolean(body.isTraded);
  if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { count } = await admin.from("item_categories").select("id", { count: "exact", head: true });

  const { data, error } = await admin
    .from("item_categories")
    .insert({ name, is_traded: isTraded, sequence: (count ?? 0) + 1 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}
