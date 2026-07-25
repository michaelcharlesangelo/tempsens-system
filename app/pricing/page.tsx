"use client";

import { useEffect, useMemo, useState } from "react";
import NavBar from "@/app/components/NavBar";
import { WIRE_TABLE, ThermocoupleType } from "@/lib/wireData";
import { MarketRates, PricingConfig, QuoteBreakdown, HEAD_ALLOWANCE_MM } from "@/lib/pricing";

const TYPES: ThermocoupleType[] = ["S", "R", "B"];
const SHOWN_DIAMETERS = [0.3, 0.35, 0.4, 0.45, 0.5];

function fmtIdr(n: number) { return "Rp " + Math.round(n).toLocaleString("id-ID"); }
function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function PricingPage() {
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [myRole, setMyRole] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [type, setType] = useState<ThermocoupleType>("S");
  const [diameter, setDiameter] = useState(0.3);
  const [lengthMm, setLengthMm] = useState(1000);
  const [configuration, setConfiguration] = useState<"simplex" | "duplex">("simplex");
  const [target, setTarget] = useState<"local" | "export">("local");
  const [breakdown, setBreakdown] = useState<QuoteBreakdown | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const diameters = useMemo(() => WIRE_TABLE.filter((w) => w.type === type && SHOWN_DIAMETERS.includes(w.diameterMm)).map((w) => w.diameterMm), [type]);

  async function loadAll() {
    const [r, c, me] = await Promise.all([
      fetch("/api/pricing/rates", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/pricing/config", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/profile", { cache: "no-store" }).then((res) => res.json()),
    ]);
    setRates(r); setConfig(c); setMyRole(me.profile?.role || "");
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (!diameters.includes(diameter)) setDiameter(diameters[0]); }, [type]); // eslint-disable-line

  useEffect(() => {
    if (!rates || !config) return;
    const timer = setTimeout(async () => {
      const res = await fetch("/api/pricing/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, diameterMm: diameter, lengthBelowHeadMm: lengthMm, configuration, spoolQtyM: config.defaultSpoolQtyM, target, extraIds: [] }),
      });
      const data = await res.json();
      if (data.breakdown) setBreakdown(data.breakdown);
    }, 300);
    return () => clearTimeout(timer);
  }, [rates, config, type, diameter, lengthMm, configuration, target]);

  async function refreshFx() {
    setRefreshing(true);
    const res = await fetch("/api/pricing/rates/refresh", { method: "POST" });
    const data = await res.json();
    setRates(data.rates);
    setMessage(data.warnings?.length ? data.warnings.join(" | ") : "FX rate refreshed.");
    setRefreshing(false);
  }

  const isAdmin = myRole === "admin";

  return (
    <>
      <NavBar active="pricing" />
      {message && <div className="warn">{message}</div>}

      <div className="card">
        <div className="grid">
          <div><label>Platinum</label><p>${rates?.platinumUsdPerOz ?? "-"}/oz</p></div>
          <div><label>Rhodium</label><p>${rates?.rhodiumUsdPerOz ?? "-"}/oz</p></div>
          <div><label>USD/EUR</label><p>{rates?.usdEurRate ?? "-"}</p></div>
          <div><label>USD/IDR</label><p>{rates ? Math.round(rates.usdIdrRate) : "-"}</p></div>
        </div>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={refreshFx} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh FX rate"}
        </button>
        {isAdmin && <a href="#admin-section" className="btn secondary" style={{ marginTop: 10, marginLeft: 8 }}>Edit rates & config ↓</a>}
      </div>

      <div className="card">
        <h2>Calculate a price</h2>
        <div className="grid">
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ThermocoupleType)}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div className="field">
            <label>Diameter (mm)</label>
            <select value={diameter} onChange={(e) => setDiameter(Number(e.target.value))}>{diameters.map((d) => <option key={d} value={d}>{d.toFixed(2)}</option>)}</select>
          </div>
          <div className="field"><label>Length below head (mm)</label><input type="number" value={lengthMm} onChange={(e) => setLengthMm(Number(e.target.value))} /></div>
        </div>
        <div className="grid" style={{ marginTop: 4 }}>
          <div className="field">
            <label>Configuration</label>
            <select value={configuration} onChange={(e) => setConfiguration(e.target.value as "simplex" | "duplex")}>
              <option value="simplex">Simplex</option><option value="duplex">Duplex</option>
            </select>
          </div>
          <div className="field">
            <label>Market</label>
            <select value={target} onChange={(e) => setTarget(e.target.value as "local" | "export")}>
              <option value="local">Local (IDR)</option><option value="export">Export (USD)</option>
            </select>
          </div>
        </div>
      </div>

      {breakdown && (
        <div className="card">
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div className="subtle">{target === "local" ? "Local cost price (modal)" : "Export selling price"}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--accent-dark)" }}>
              {breakdown.currency === "IDR" ? fmtIdr(breakdown.finalPrice) : fmtUsd(breakdown.finalPrice)}
            </div>
            <div className="subtle" style={{ textTransform: "uppercase" }}>{type} {diameter.toFixed(2)}, {configuration}, LBH {lengthMm}mm</div>
          </div>
          <button className="btn secondary" style={{ width: "100%" }} onClick={() => setShowDetails((s) => !s)}>{showDetails ? "Hide" : "Show"} calculation</button>
          {showDetails && (
            <table className="data-table" style={{ marginTop: 10 }}>
              <tbody>
                <tr><td>Wire cost/meter (market)</td><td>{target === "local" ? fmtIdr(breakdown.marketRatePerMeter) : fmtUsd(breakdown.marketRatePerMeter)}</td></tr>
                <tr><td>Source</td><td>{breakdown.wireRateSource}</td></tr>
                <tr><td>Scaled wire cost</td><td>{target === "local" ? fmtIdr(breakdown.scaledWireCost) : fmtUsd(breakdown.scaledWireCost)}</td></tr>
                <tr><td>After profit/margin</td><td>{target === "local" ? fmtIdr(breakdown.afterProfitOrMargin) : fmtUsd(breakdown.afterProfitOrMargin)}</td></tr>
                <tr><td>Standard parts</td><td>{target === "local" ? fmtIdr(breakdown.standardPartsCost) : fmtUsd(breakdown.standardPartsCost)}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {isAdmin && config && rates && (
        <div className="card" id="admin-section">
          <h2>Rates & config (admin)</h2>
          <p className="subtle">Full rate/config management mirrors the standalone pricer - condensed here since it's role-gated already.</p>
          <div className="grid">
            <div className="field"><label>Platinum (USD/oz)</label><input type="number" value={rates.platinumUsdPerOz} onChange={(e) => setRates({ ...rates, platinumUsdPerOz: Number(e.target.value) })} /></div>
            <div className="field"><label>Rhodium (USD/oz)</label><input type="number" value={rates.rhodiumUsdPerOz} onChange={(e) => setRates({ ...rates, rhodiumUsdPerOz: Number(e.target.value) })} /></div>
          </div>
          <button className="btn" onClick={async () => {
            const res = await fetch("/api/pricing/rates/metal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platinumUsdPerOz: rates.platinumUsdPerOz, rhodiumUsdPerOz: rates.rhodiumUsdPerOz }) });
            const data = await res.json();
            if (res.ok) { setRates(data); setMessage("Metal prices saved."); } else setMessage(data.error);
          }}>Save metal prices</button>
        </div>
      )}
    </>
  );
}
