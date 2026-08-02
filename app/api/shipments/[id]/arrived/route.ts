import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Separate from the main shipments PATCH route (which is FormData-driven
// and always rewrites every field from the edit form) so flipping this one
// tickbox can never accidentally blank out the rest of the shipment.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const arrived = !!body.arrived;
  const changedBy = typeof body.changedBy === "string" && body.changedBy.trim() ? body.changedBy.trim() : "Exim";

  const admin = getSupabaseAdminClient();
  const { data: shipment, error } = await admin.from("shipments").update({ arrived }).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cascade to every PO Out row tied to this shipment - a shipment either
  // hasn't landed or it has, no separate per-line confirmation needed.
  if (arrived && shipment.shipment_number) {
    const { data: rows } = await admin
      .from("po_out")
      .select("id")
      .eq("shipment", shipment.shipment_number)
      .neq("status", "arrived");
    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await admin.from("po_out").update({ status: "arrived" }).in("id", ids);
      await admin.from("po_out_history").insert(
        ids.map((id: string) => ({
          po_out_id: id, changed_by: changedBy, status: "arrived",
          comment: `Arrived - shipment ${shipment.shipment_number} marked arrived.`,
        }))
      );
    }
  }

  return NextResponse.json({ shipment });
}
