import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { ItemCategory } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const direction = body.direction === "up" ? "up" : "down";

  const admin = getSupabaseAdminClient();
  const { data: raw } = await admin.from("item_categories").select("*").order("sequence");
  if (!raw) return NextResponse.json({ error: "No categories found." }, { status: 404 });
  const categories = raw as ItemCategory[];

  const idx = categories.findIndex((c) => c.id === params.id);
  if (idx === -1) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= categories.length) {
    return NextResponse.json({ error: "Already at the edge." }, { status: 400 });
  }

  const a = categories[idx];
  const b = categories[swapIdx];

  await admin.from("item_categories").update({ sequence: b.sequence }).eq("id", a.id);
  await admin.from("item_categories").update({ sequence: a.sequence }).eq("id", b.id);

  const { data: updated } = await admin.from("item_categories").select("*").order("sequence");
  return NextResponse.json({ categories: updated });
}
