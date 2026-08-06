import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUSES = ["plan", "shipment", "arrived"];
const STATUS_LABELS: Record<string, string> = { plan: "Plan", shipment: "Shipment", arrived: "Arrived" };

// Replaces the old separate /shipped and /arrived routes with a single
// Plan -> Shipment -> Arrived progression (mirrors PO Out's own status
// slider, one level up). Moving to Shipment cascades every PO Out row
// still at "production" on this shipment to "shipment"; moving to Arrived
// cascades every PO Out row on this shipment to "arrived". A comment given
// alongside either transition (or on its own, with no status change) is
// posted to every PO Out row's history on this shipment.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const status = typeof body.status === "string" ? body.status : "";
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const changedBy = typeof body.changedBy === "string" && body.changedBy.trim() ? body.changedBy.trim() : "Exim";

  const admin = getSupabaseAdminClient();
  const { data: before } = await admin.from("shipments").select("status").eq("id", params.id).maybeSingle();
  const { data: shipment, error } = await admin.from("shipments").update({ status }).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The shipment's own log - written unconditionally (unlike the po_out_history
  // cascade below, which only fires once a shipment_number is tied to PO Out
  // rows), so a comment posted before that link exists is never lost. Only
  // logged when there's actually something to show: a status change or a
  // typed comment, same gating as the po_out_history cascade below.
  const statusChanged = before?.status !== status;
  if (statusChanged || comment) {
    await admin.from("shipment_history").insert({
      shipment_id: params.id, changed_by: changedBy, comment,
      status: statusChanged ? status : null,
    });
  }

  if (shipment.shipment_number) {
    if (status === "shipment" || status === "arrived") {
      let query = admin.from("po_out").select("id").eq("shipment", shipment.shipment_number);
      query = status === "shipment" ? query.eq("status", "production") : query.neq("status", "arrived");
      const { data: rows } = await query;
      const ids = (rows ?? []).map((r: { id: string }) => r.id);
      if (ids.length > 0) {
        await admin.from("po_out").update({ status }).in("id", ids);
        await admin.from("po_out_history").insert(
          ids.map((id: string) => ({
            po_out_id: id, changed_by: changedBy, status,
            comment: comment || `${STATUS_LABELS[status]} - shipment ${shipment.shipment_number} marked ${STATUS_LABELS[status].toLowerCase()}.`,
          }))
        );
      }
    } else if (comment) {
      // Plan, or a comment posted without changing status (e.g. a delay
      // notice) - still lands on every PO Out row's history, no status set.
      const { data: rows } = await admin.from("po_out").select("id").eq("shipment", shipment.shipment_number);
      const ids = (rows ?? []).map((r: { id: string }) => r.id);
      if (ids.length > 0) {
        await admin.from("po_out_history").insert(ids.map((id: string) => ({ po_out_id: id, changed_by: changedBy, comment })));
      }
    }
  }

  return NextResponse.json({ shipment });
}
