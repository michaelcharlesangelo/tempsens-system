import { NextRequest, NextResponse } from "next/server";
import { setFxRates } from "@/lib/pricingStore";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admin can change the FX rate." }, { status: 403 });
  }

  const body = await req.json();
  const usdEurRate = Number(body.usdEurRate);
  const usdIdrRate = Number(body.usdIdrRate);
  if (!Number.isFinite(usdEurRate) || !Number.isFinite(usdIdrRate)) {
    return NextResponse.json({ error: "Invalid FX rate values" }, { status: 400 });
  }

  const rates = await setFxRates(usdEurRate, usdIdrRate, "manual");
  return NextResponse.json(rates);
}
