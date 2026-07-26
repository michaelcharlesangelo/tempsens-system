import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: account } = await admin.from("production_accounts").select("*").eq("username", username).maybeSingle();

  if (!account || !verifyPassword(password, account.password_hash)) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  return NextResponse.json({ account: { id: account.id, username: account.username, full_name: account.full_name } });
}
