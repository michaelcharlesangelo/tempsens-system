import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("sales_teams")
    .select("*, sales_team_members(sales_account_id)")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const teams = (data ?? []).map((t) => ({
    id: t.id,
    sales_support_account_id: t.sales_support_account_id,
    sales_manager_account_id: t.sales_manager_account_id,
    created_at: t.created_at,
    member_ids: (t.sales_team_members ?? []).map((m: { sales_account_id: string }) => m.sales_account_id),
  }));
  return NextResponse.json({ teams });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const salesSupportAccountId = typeof body.salesSupportAccountId === "string" && body.salesSupportAccountId ? body.salesSupportAccountId : null;
  const salesManagerAccountId = typeof body.salesManagerAccountId === "string" && body.salesManagerAccountId ? body.salesManagerAccountId : null;
  const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds.filter((id: unknown) => typeof id === "string") : [];

  if (!salesSupportAccountId) return NextResponse.json({ error: "A Sales Support person is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data: team, error } = await admin
    .from("sales_teams")
    .insert({ sales_support_account_id: salesSupportAccountId, sales_manager_account_id: salesManagerAccountId })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (memberIds.length > 0) {
    await admin.from("sales_team_members").insert(memberIds.map((id) => ({ team_id: team.id, sales_account_id: id })));
  }

  return NextResponse.json({ team });
}
