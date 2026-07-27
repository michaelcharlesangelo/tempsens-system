export type JobOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "acknowledged"
  | "in_progress"
  | "qc"
  | "completed"
  | "cancelled";

export const STATUS_LABELS: Record<JobOrderStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  qc: "QC",
  completed: "Completed",
  cancelled: "Cancelled",
};

// The 3 sequential approval layers - each corresponds to one of the tabs.
export const APPROVAL_LAYERS: { layer: 1 | 2 | 3; tab: string; label: string }[] = [
  { layer: 1, tab: "sales-manager", label: "Sales Manager" },
  { layer: 2, tab: "operation-manager", label: "Operational Manager" },
  { layer: 3, tab: "gm", label: "General Manager" },
];

export interface JobOrder {
  id: string;
  jo_number: string;
  jo_date: string;
  customer_name: string;
  so_no: string;
  item_category: string;
  item_description: string;
  drawing_path: string | null;
  drawing_filename?: string | null;
  drawing_number: string;
  quantity: number;
  item_no: string;
  sales_person_name: string;
  sales_support_name: string;
  deadline: string | null;
  urgent: boolean;
  po_attachment_path?: string | null; // omitted by the API for unauthorized tabs
  po_attachment_filename?: string | null;
  serial_no: string;
  finish_estimation: string | null;
  finish_date: string | null;
  ready_for_production: boolean;
  costing_done: boolean;
  barcode: string | null;
  status: JobOrderStatus;
  current_approval_layer: 1 | 2 | 3 | null;
  created_at: string;
  approved_at: string | null;
  // Embedded on list/detail responses - full approval/action comment trail,
  // oldest first, so each layer can see what earlier layers said.
  history?: JobOrderHistoryEntry[];
  // Computed by GET /api/job-orders - true only when every material_ready
  // BOM row is currently material_prepared (live, not a status snapshot).
  material_prepared_all?: boolean;
}

export interface JobOrderHistoryEntry {
  id: string;
  job_order_id: string;
  status: string;
  changed_by: string;
  comment: string;
  changed_at: string;
}

export interface BomItem {
  id: string;
  job_order_id: string;
  item_no: string;
  description: string;
  qty: number;
  unit: string;
  material_ready: boolean;
  material_prepared?: boolean;
  actual_qty: number | null;
  actual_unit: string | null;
  comment: string;
  procurement_method?: string | null;
  created_at: string;
}

// Finds who most recently rejected a job order, from its history trail.
export function rejectedByFromHistory(history: JobOrderHistoryEntry[] | undefined): string | null {
  if (!history || history.length === 0) return null;
  const entry = [...history].reverse().find((h) => h.status === "rejected");
  return entry ? entry.changed_by : null;
}

export interface StationCode {
  id: string;
  code: string;
  station_name: string;
  description: string;
  parameter: string;
  sequence: number;
  active: boolean;
  created_at: string;
}

export interface ProductionLog {
  id: string;
  job_order_id: string;
  station_id: string;
  scanned_by: string;
  actual_value: string;
  scanned_at: string;
  // Embedded on the JO detail response for the QC-parameter table.
  station?: { station_name: string; parameter: string };
  account?: { full_name: string };
}

export type QcCheckType = "dimensional" | "continuity_resistance" | "ir_check" | "temperature";

export const QC_CHECK_LABELS: Record<QcCheckType, string> = {
  dimensional: "Dimensional Check",
  continuity_resistance: "TC Continuity / RTD Resistance Check",
  ir_check: "I.R. Check",
  temperature: "Temperature Check",
};

export interface QcCheck {
  id: string;
  job_order_id: string;
  check_type: QcCheckType;
  result: "ok" | "not_ok";
  value_text: string;
  performed_by: string;
  performed_at: string;
}

export interface Position {
  id: string;
  name: string;
  sequence: number;
}

export interface ProductionAccount {
  id: string;
  username: string;
  full_name: string;
  position_id: string | null;
}

export interface SalesPerson {
  id: string;
  name: string;
  email: string;
  position_id: string | null;
}

export interface BackOfficePerson {
  id: string;
  name: string;
  email: string;
  position_id: string | null;
}

export interface ItemCategory {
  id: string;
  name: string;
  is_traded: boolean;
  sequence: number;
}

export interface BomTemplateRow {
  itemNo: string;
  description: string;
  qty: number;
  unit: string;
}

export interface BomTemplate {
  item_no: string;
  description: string;
  bom_snapshot: BomTemplateRow[];
  saved_at: string;
  source_jo_number: string;
  drawing_path: string | null;
  drawing_number: string;
}

// Generates the next JO number for the current year, e.g. JO-2026-0001.
export function generateJoNumber(existingCountThisYear: number): string {
  const year = new Date().getFullYear();
  const seq = String(existingCountThisYear + 1).padStart(4, "0");
  return `JO-${year}-${seq}`;
}

// Generates a short random unique code for QR content.
export function generateShortCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}

export type ComplaintStatus = "not_done" | "in_progress" | "done";

export interface Complaint {
  id: string;
  customer_name: string;
  so_no: string;
  item_description: string;
  quantity: number;
  is_traded: boolean;
  problem_description: string;
  photo_paths: string[];
  status: ComplaintStatus;
  suggested_action: string;
  submitted_by: string;
  created_at: string;
  resolved_at: string | null;
}

// Shared search predicates for the paged/searchable list tables - term is
// already lowercased by usePagedSearch before this is called.
export function joMatchesSearch(jo: JobOrder, term: string): boolean {
  return (
    jo.so_no.toLowerCase().includes(term) ||
    jo.item_no.toLowerCase().includes(term) ||
    fmtDate(jo.jo_date).includes(term) ||
    fmtDate(jo.created_at).includes(term)
  );
}

export function complaintMatchesSearch(c: Complaint, term: string): boolean {
  return (
    c.so_no.toLowerCase().includes(term) ||
    c.item_description.toLowerCase().includes(term) ||
    c.customer_name.toLowerCase().includes(term) ||
    fmtDate(c.created_at).includes(term)
  );
}

// Simplified 3-bucket status label for the Dashboard, per Michael's spec:
// not yet fully approved / approved / actually being built.
export function dashboardStatusLabel(status: JobOrderStatus): string {
  if (status === "draft" || status === "pending_approval") return "Draft";
  if (status === "approved") return "Approved";
  if (status === "acknowledged") return "Preparing Item";
  if (status === "in_progress" || status === "qc") return "Under Production";
  if (status === "completed") return "Completed";
  return status;
}

// dd/mm/yyyy for plain dates, matching Indonesian convention used
// throughout this app - never rely on toLocaleDateString() directly
// (defaults to US mm/dd/yyyy).
export function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

// dd-Mmm-yyyy, used specifically on the JO form's date fields.
export function fmtDateLong(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${day}-${month}-${d.getFullYear()}`;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Detailed progress label for the Sales Support view - more specific than
// the Dashboard's simplified 3-bucket version.
export function salesSupportProgressLabel(jo: { status: JobOrderStatus; current_approval_layer: 1 | 2 | 3 | null }): string {
  if (jo.status === "pending_approval") {
    const layerLabel = APPROVAL_LAYERS.find((l) => l.layer === jo.current_approval_layer)?.label;
    return `Under approval of ${layerLabel ?? "approver"}`;
  }
  if (jo.status === "approved") return "Approved, awaiting Production Manager";
  if (jo.status === "acknowledged") return "Acknowledged by Production";
  if (jo.status === "in_progress") return "Under Production";
  if (jo.status === "qc") return "QC";
  if (jo.status === "completed") return "Completed";
  if (jo.status === "rejected") return "Rejected";
  if (jo.status === "cancelled") return "Cancelled";
  return jo.status;
}
