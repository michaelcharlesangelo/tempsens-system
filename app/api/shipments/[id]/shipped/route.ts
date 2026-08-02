import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Mirrors /api/shipments/[id]/arrived - the first step of the same
// progression (Production -> Shipment -> Arrived), cascading every PO Out
// row still at "production" on this shipment to "shipment" at once.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const shipped = !!body.shipped;
  const changedBy = typeof body.changedBy === "string" && body.changedBy.trim() ? body.changedBy.trim() : "Exim";

  const admin = getSupabaseAdminClient();
  const { data: shipment, error } = await admin.from("shipments").update({ shipped }).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (shipped && shipment.shipment_number) {
    const { data: rows } = await admin
      .from("po_out")
      .select("id")
      .eq("shipment", shipment.shipment_number)
      .eq("status", "production");
    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await admin.from("po_out").update({ status: "shipment" }).in("id", ids);
      await admin.from("po_out_history").insert(
        ids.map((id: string) => ({
          po_out_id: id, changed_by: changedBy, status: "shipment",
          comment: `Shipment - shipment ${shipment.shipment_number} marked shipped.`,
        }))
      );
    }
  }

  return NextResponse.json({ shipment });
}
