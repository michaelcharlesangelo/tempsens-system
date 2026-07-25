import { NextRequest, NextResponse } from "next/server";
import { getConfig, setConfig } from "@/lib/pricingStore";
import { PricingConfig } from "@/lib/pricing";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const config = await getConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admin can change pricing config." }, { status: 403 });
  }

  const body = (await req.json()) as PricingConfig;
  if (!body || typeof body !== "object" || !Array.isArray(body.stockPrices)) {
    return NextResponse.json({ error: "Invalid config shape" }, { status: 400 });
  }
  await setConfig({ ...body, configUpdatedAt: new Date().toISOString() });
  return NextResponse.json(body);
}
