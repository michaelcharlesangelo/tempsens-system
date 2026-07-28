import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/auth";
import { SALES_QUALIFYING_POSITIONS } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // ?forSales=true narrows to accounts whose position qualifies them for
  // the JO/Complaints "Sales" dropdown (see SALES_QUALIFYING_POSITIONS).
  const forSales = req.nextUrl.searchParams.get("forSales") === "true";
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("production_accounts")
    .select("id, username, full_name, position_id, created_at, position:positions(name)")
    .order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accounts = forSales
    ? (data ?? []).filter((a) => {
        const pos = (a as { position?: { name: string } | { name: string }[] }).position;
        const name = Array.isArray(pos) ? pos[0]?.name : pos?.name;
        return SALES_QUALIFYING_POSITIONS.includes(name ?? "");
      })
    : data;
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const positionId = typeof body.positionId === "string" && body.positionId ? body.positionId : null;

  if (!username || !password || !fullName) {
    return NextResponse.json({ error: "Username, password, and full name are required." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("production_accounts")
    .insert({ username, password_hash: hashPassword(password), full_name: fullName, position_id: positionId })
    .select("id, username, full_name, position_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data });
}
