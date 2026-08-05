import { Currency } from "@/lib/jobOrders";

export type ProjectStatus = "ongoing" | "finished";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "ongoing", label: "On-going", color: "#eab308" },
  { value: "finished", label: "Finished", color: "#22c55e" },
];

export interface ProjectLineItem {
  id: string;
  item_description: string;
  supplier: string;
  qty: number;
  unit: string;
  unit_price: number;
  unit_price_currency: Currency;
  total_price: number;
  created_at: string;
}

// Cost items are the same shape as budget items plus po_code (a cost line
// is tied to an actual purchase; a budget line is only a plan) and
// progress_id (set when logged via a Status update, so it can be shown
// against just that Progress History entry rather than the accumulated
// project-wide total).
export interface ProjectCostItem extends ProjectLineItem {
  po_code: string;
  submitted_by: string;
  progress_id: string | null;
}

export interface ProjectProgressEntry {
  id: string;
  project_id: string;
  status: ProjectStatus;
  comment: string;
  changed_by: string;
  changed_at: string;
}

export interface ProjectReport {
  id: string;
  project_id: string;
  progress_id: string | null;
  report: string;
  next_step: string;
  photo_paths: string[];
  submitted_by: string;
  created_at: string;
}

export interface Project {
  id: string;
  project_number: string;
  customer_name: string;
  project_description: string;
  has_po: boolean;
  po_date: string | null;
  po_number: string;
  po_value: number;
  po_value_currency: Currency;
  sales: string;
  status: ProjectStatus;
  submitted_by: string;
  created_at: string;
  budget_items: ProjectLineItem[];
  cost_items: ProjectCostItem[];
  progress: ProjectProgressEntry[];
  reports: ProjectReport[];
}

export function lineItemsTotal(items: { total_price: number }[]): number {
  return items.reduce((n, it) => n + Number(it.total_price || 0), 0);
}
