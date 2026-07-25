import { getSupabaseAdminClient } from "./supabaseAdmin";
import { MarketRates, PricingConfig, DEFAULT_CONFIG } from "./pricing";

const RATES_KEY = "pricing:rates";
const CONFIG_KEY = "pricing:config";

const DEFAULT_RATES: MarketRates = {
  platinumUsdPerOz: 1628,
  rhodiumUsdPerOz: 8800,
  metalUpdatedAt: new Date(0).toISOString(),
  usdEurRate: 0.8748,
  usdIdrRate: 17973,
  fxUpdatedAt: new Date(0).toISOString(),
  fxSource: "manual",
};

async function getValue<T>(key: string, fallback: T): Promise<T> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("app_kv").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`Supabase read failed for ${key}: ${error.message}`);
  return (data?.value as T) ?? fallback;
}

async function setValue<T>(key: string, value: T): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("app_kv")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Supabase write failed for ${key}: ${error.message}`);
}

export async function getRates(): Promise<MarketRates> {
  return getValue(RATES_KEY, DEFAULT_RATES);
}

export async function setRates(rates: MarketRates): Promise<void> {
  await setValue(RATES_KEY, rates);
}

export async function setMetalRates(platinumUsdPerOz: number, rhodiumUsdPerOz: number): Promise<MarketRates> {
  const current = await getRates();
  const updated: MarketRates = { ...current, platinumUsdPerOz, rhodiumUsdPerOz, metalUpdatedAt: new Date().toISOString() };
  await setRates(updated);
  return updated;
}

export async function setFxRates(usdEurRate: number, usdIdrRate: number, source: "auto" | "manual"): Promise<MarketRates> {
  const current = await getRates();
  const updated: MarketRates = { ...current, usdEurRate, usdIdrRate, fxUpdatedAt: new Date().toISOString(), fxSource: source };
  await setRates(updated);
  return updated;
}

export async function getConfig(): Promise<PricingConfig> {
  return getValue(CONFIG_KEY, DEFAULT_CONFIG);
}

export async function setConfig(config: PricingConfig): Promise<void> {
  await setValue(CONFIG_KEY, config);
}
