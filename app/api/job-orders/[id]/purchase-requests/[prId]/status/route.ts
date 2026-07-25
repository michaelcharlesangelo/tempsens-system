import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_STATUSES = ["pending", "approved", "rejected", "ordered", "received"];

export async function POST(req: NextRequest, { params }: { params: { id: string; prId: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const status = body.status as string;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: pr, error: fetchError } = await admin
    .from("purchase_requests")
    .select("*")
    .eq("id", params.prId)
    .maybeSingle();

  if (fetchError || !pr) return NextResponse.json({ error: "Purchase request not found." }, { status: 404 });

  if ((status === "approved" || status === "rejected") && profile.role !== "admin" && profile.id !== pr.approver_id) {
    return NextResponse.json({ error: "Only the assigned approver can do that." }, { status: 403 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "approved" || status === "rejected") updates.resolved_at = new Date().toISOString();

  const { data: updated, error: updateError } = await admin
    .from("purchase_requests")
    .update(updates)
    .eq("id", params.prId)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (status === "approved" || status === "rejected") {
    await notify(
      pr.requested_by,
      "purchase_request_resolved",
      `Purchase request ${status}: ${pr.item_name}`,
      `${profile.full_name || profile.email} ${status} your request for ${pr.quantity} x ${pr.item_name}.`,
      `/job-orders/${params.id}`
    );
  }

  return NextResponse.json({ purchaseRequest: updated });
}
