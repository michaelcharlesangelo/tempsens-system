import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURRENCIES = ["IDR", "USD", "SGD", "EUR", "CNY", "JPY"];

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data: projects, error } = await admin.from("projects").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projectIds = (projects ?? []).map((p) => p.id);
  const [budgetRes, costRes, progressRes, reportsRes] = await Promise.all([
    projectIds.length ? admin.from("project_budget_items").select("*").in("project_id", projectIds).order("created_at") : { data: [] },
    projectIds.length ? admin.from("project_cost_items").select("*").in("project_id", projectIds).order("created_at") : { data: [] },
    projectIds.length ? admin.from("project_progress").select("*").in("project_id", projectIds).order("changed_at") : { data: [] },
    projectIds.length ? admin.from("project_reports").select("*").in("project_id", projectIds).order("created_at", { ascending: false }) : { data: [] },
  ]);

  const byProject = <T extends { project_id: string }>(rows: T[] | null | undefined) => {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const list = map.get(row.project_id) ?? [];
      list.push(row);
      map.set(row.project_id, list);
    }
    return map;
  };
  const budgetByProject = byProject(budgetRes.data as { project_id: string }[]);
  const costByProject = byProject(costRes.data as { project_id: string }[]);
  const progressByProject = byProject(progressRes.data as { project_id: string }[]);
  const reportsByProject = byProject(reportsRes.data as { project_id: string }[]);

  const withChildren = (projects ?? []).map((p) => ({
    ...p,
    budget_items: budgetByProject.get(p.id) ?? [],
    cost_items: costByProject.get(p.id) ?? [],
    progress: progressByProject.get(p.id) ?? [],
    reports: reportsByProject.get(p.id) ?? [],
  }));

  return NextResponse.json({ projects: withChildren });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const projectNumber = typeof body.projectNumber === "string" ? body.projectNumber.trim().toUpperCase() : "";
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const projectDescription = typeof body.projectDescription === "string" ? body.projectDescription.trim() : "";
  const hasPo = body.hasPo !== false;
  const submittedBy = typeof body.submittedBy === "string" ? body.submittedBy.trim() : "";

  if (!projectNumber || !customerName) {
    return NextResponse.json({ error: "Project Number and Customer Name are required." }, { status: 400 });
  }

  // has_po is purely a "Not PO" marker now, not a data toggle - PO Date/
  // Number/Value stay fillable and get saved either way.
  const row: Record<string, unknown> = {
    project_number: projectNumber,
    customer_name: customerName,
    project_description: projectDescription,
    has_po: hasPo,
    po_date: body.poDate || null,
    po_number: typeof body.poNumber === "string" ? body.poNumber.trim().toUpperCase() : "",
    po_value: Number(body.poValue) || 0,
    po_value_currency: CURRENCIES.includes(body.poValueCurrency) ? body.poValueCurrency : "IDR",
    sales: typeof body.sales === "string" ? body.sales.trim() : "",
    submitted_by: submittedBy,
  };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("projects").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: { ...data, budget_items: [], cost_items: [], progress: [], reports: [] } });
}
