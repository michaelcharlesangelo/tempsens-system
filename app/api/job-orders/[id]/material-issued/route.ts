import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role !== "admin" && profile.role !== "warehouse_manager") {
    return NextResponse.json({ error: "Only the Warehouse Manager can do that." }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("job_orders")
    .update({ material_issued: true, material_issued_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notify(data.created_by, "material_issued", `Material issued: ${data.jo_number}`,
    `${profile.full_name || profile.email} confirmed material has been taken from warehouse.`, `/job-orders/${data.id}`);

  return NextResponse.json({ jobOrder: data });
}
