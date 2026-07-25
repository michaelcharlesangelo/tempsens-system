import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const itemName = typeof body.itemName === "string" ? body.itemName.trim() : "";
  const quantity = Number(body.quantity);
  const bomItemId = typeof body.bomItemId === "string" && body.bomItemId ? body.bomItemId : null;
  const approverId = typeof body.approverId === "string" && body.approverId ? body.approverId : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!itemName) return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than 0." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("purchase_requests")
    .insert({
      job_order_id: params.id,
      bom_item_id: bomItemId,
      item_name: itemName,
      quantity,
      status: "pending",
      requested_by: profile.id,
      approver_id: approverId,
      notes,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (approverId) {
    const { data: jo } = await admin.from("job_orders").select("jo_number").eq("id", params.id).maybeSingle();
    await notify(
      approverId,
      "purchase_approval_pending",
      `Purchase approval needed: ${itemName}`,
      `${profile.full_name || profile.email} requested ${quantity} x ${itemName} for ${jo?.jo_number ?? "a job order"}.`,
      `/job-orders/${params.id}`
    );
  }

  return NextResponse.json({ purchaseRequest: data });
}
