"use client";

import { useEffect, useState } from "react";
import ApprovalTabView from "@/app/components/ApprovalTabView";
import { JobOrder, SalesTeam } from "@/lib/jobOrders";

interface AccountWithPosition { id: string; full_name: string; position?: { name: string } | { name: string }[] | null; }

const VIEW_AS_KEY = "tempsens-sales-manager-viewing-as";

export default function SalesManagerPage() {
  const [salesManagers, setSalesManagers] = useState<AccountWithPosition[]>([]);
  const [teams, setTeams] = useState<SalesTeam[]>([]);
  const [viewingAs, setViewingAs] = useState("");

  useEffect(() => {
    fetch("/api/production-accounts", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const accounts = (d.accounts ?? []) as AccountWithPosition[];
      setSalesManagers(accounts.filter((a) => {
        const pos = a.position;
        const name = Array.isArray(pos) ? pos[0]?.name : pos?.name;
        return name === "Sales Manager";
      }));
    });
    fetch("/api/sales-teams", { cache: "no-store" }).then((r) => r.json()).then((d) => setTeams(d.teams ?? []));
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(VIEW_AS_KEY) : null;
    if (stored) setViewingAs(stored);
  }, []);

  function pickViewingAs(id: string) {
    setViewingAs(id);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_AS_KEY, id);
  }

  // A JO with no submitter picked, or whose Sales Support person isn't on
  // any team yet, stays visible to every Sales Manager - only JOs whose
  // team is fully set up actually get scoped down.
  function filterJobOrders(jos: JobOrder[]): JobOrder[] {
    if (!viewingAs) return jos;
    const routedSupportIds = new Set(teams.map((t) => t.sales_support_account_id).filter(Boolean));
    const myTeamSupportIds = new Set(teams.filter((t) => t.sales_manager_account_id === viewingAs).map((t) => t.sales_support_account_id));
    return jos.filter((jo) => {
      if (!jo.sales_support_account_id) return true;
      if (!routedSupportIds.has(jo.sales_support_account_id)) return true;
      return myTeamSupportIds.has(jo.sales_support_account_id);
    });
  }

  return (
    <>
      {salesManagers.length > 0 && (
        <div className="card">
          <div className="field" style={{ maxWidth: 320, marginBottom: 0 }}>
            <label>Viewing as (Sales Manager)</label>
            <select value={viewingAs} onChange={(e) => pickViewingAs(e.target.value)}>
              <option value="">All teams</option>
              {salesManagers.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
        </div>
      )}
      <ApprovalTabView tab="sales-manager" layer={1} label="Sales Manager" filterJobOrders={filterJobOrders} />
    </>
  );
}
