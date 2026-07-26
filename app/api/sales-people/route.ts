import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("sales_people").select("id, name, email, position_id, created_at").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ salesPeople: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const positionId = typeof body.positionId === "string" && body.positionId ? body.positionId : null;
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("sales_people")
    .insert({ name, email, password_hash: password ? hashPassword(password) : "", position_id: positionId })
    .select("id, name, email, position_id, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ salesPerson: data });
}
