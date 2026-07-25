import { NextRequest, NextResponse } from "next/server";
import { getRates, getConfig } from "@/lib/pricingStore";
import { calculateQuote, QuoteInput } from "@/lib/pricing";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const input = (await req.json()) as QuoteInput;
  try {
    const [rates, config] = await Promise.all([getRates(), getConfig()]);
    const breakdown = calculateQuote(input, rates, config);
    return NextResponse.json({ breakdown, rates });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
