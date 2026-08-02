import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("hs_codes").select("*").order("code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hsCodes: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const bm = Number(body.bm) || 0;
  if (!code) return NextResponse.json({ error: "Code is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("hs_codes").upsert({ code, description, bm }, { onConflict: "code" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hsCode: data });
}
