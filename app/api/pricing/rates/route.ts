import { NextResponse } from "next/server";
import { getRates } from "@/lib/pricingStore";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const rates = await getRates();
  return NextResponse.json(rates);
}
