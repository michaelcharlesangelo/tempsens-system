import { NextRequest, NextResponse } from "next/server";
import { setMetalRates } from "@/lib/pricingStore";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admin can change metal prices." }, { status: 403 });
  }

  const body = await req.json();
  const platinumUsdPerOz = Number(body.platinumUsdPerOz);
  const rhodiumUsdPerOz = Number(body.rhodiumUsdPerOz);
  if (!Number.isFinite(platinumUsdPerOz) || !Number.isFinite(rhodiumUsdPerOz)) {
    return NextResponse.json({ error: "Invalid metal price values" }, { status: 400 });
  }

  const rates = await setMetalRates(platinumUsdPerOz, rhodiumUsdPerOz);
  return NextResponse.json(rates);
}
