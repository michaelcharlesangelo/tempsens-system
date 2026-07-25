import { NextResponse } from "next/server";
import { getRates, setRates } from "@/lib/pricingStore";
import { fetchLiveFx, mergeFxIntoRates } from "@/lib/fetchRates";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const previous = await getRates();
  const fx = await fetchLiveFx();
  const merged = mergeFxIntoRates(previous, fx);
  await setRates(merged);
  return NextResponse.json({ rates: merged, warnings: fx.error ? [fx.error] : [] });
}
