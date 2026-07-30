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
  { layer: 2, tab: "operational-manager", label: "Operational Manager" },
  { layer: 3, tab: "general-manager", label: "General Manager" },
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
  sales_support_account_id: string | null;
  deadline: string | null;
  urgent: boolean;
  po_attachment_path?: string | null; // omitted by the API for unauthorized tabs
  po_attachment_filename?: string | null;
  // One entry per unit produced - a JO's quantity can be >1, so this is
  // an array (Postgres text[]) rather than a single serial_no field.
  serial_numbers: string[];
  finish_estimation: string | null;
  finish_date: string | null;
  ready_for_production: boolean;
  costing_done: boolean;
  barcode: string | null;
  current_station_name: string | null;
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
  parameters: string[];
  sequence: number;
  active: boolean;
  created_at: string;
}

export interface ProductionLogResult {
  parameter: string;
  actual: string;
  // 0-based index into the JO's quantity/serial_numbers - which unit this
  // reading belongs to. Missing on older records (pre-multi-unit), which
  // should be treated as unit 0.
  unit?: number;
}

export interface ProductionLog {
  id: string;
  job_order_id: string;
  station_id: string;
  scanned_by: string | null;
  // Set directly (e.g. "Production") when there's no real logged-in
  // account - login is bypassed for now, see CLAUDE.md.
  scanned_by_label: string | null;
  results: ProductionLogResult[];
  scanned_at: string;
  // Embedded on the JO detail response for the QC-parameter table.
  station?: { station_name: string };
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

// Position names that make an Account eligible to appear in the "Sales"
// dropdown on the JO Input and Complaints pages.
export const SALES_QUALIFYING_POSITIONS = ["Sales", "Sales Manager", "General Manager"];

// Groups one Sales Support account with the Sales reps and the single
// Sales Manager account they route to - see /settings (Account tab) and
// /sales-manager's "Viewing as" filter.
export interface SalesTeam {
  id: string;
  sales_support_account_id: string | null;
  sales_manager_account_id: string | null;
  member_ids: string[];
  created_at: string;
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

export const COMPLAINT_STATUSES: { value: ComplaintStatus; label: string; color: string }[] = [
  { value: "not_done", label: "Not Done", color: "#ef4444" },
  { value: "in_progress", label: "In Progress", color: "#3b82f6" },
  { value: "done", label: "Done", color: "#22c55e" },
];

export interface ComplaintHistoryEntry {
  id: string;
  complaint_id: string;
  changed_by: string;
  comment: string;
  status: ComplaintStatus | null;
  changed_at: string;
}

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
  archived: boolean;
  engineering_photo_paths: string[];
  history: ComplaintHistoryEntry[];
}

// Shared search predicates for the paged/searchable list tables - term is
// already lowercased by usePagedSearch before this is called.
export function joMatchesSearch(jo: JobOrder, term: string): boolean {
  return (
    jo.so_no.toLowerCase().includes(term) ||
    jo.item_no.toLowerCase().includes(term) ||
    fmtDate(jo.jo_date).includes(term) ||
    fmtDate(jo.created_at).includes(term) ||
    (jo.serial_numbers ?? []).some((s) => s.toLowerCase().includes(term))
  );
}

// A JO's quantity can be 60+ units, each needing its own serial - one
// input per unit doesn't scale, so Production Manager enters a single
// base serial (e.g. "2604/0100") and this generates the full sequential
// range. Every entry is still stored individually so Work History can
// search/find any one of them; only the display is compacted.
export function generateSerials(base: string, qty: number): string[] {
  const trimmed = base.trim();
  if (!trimmed || qty <= 0) return [];
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return Array.from({ length: qty }, (_, i) => (qty === 1 ? trimmed : `${trimmed}-${i + 1}`));
  const [, prefix, numStr] = match;
  const width = numStr.length;
  const start = parseInt(numStr, 10);
  return Array.from({ length: qty }, (_, i) => `${prefix}${String(start + i).padStart(width, "0")}`);
}

// Compact display for a generated serial range - single value as-is,
// otherwise "first – last (N pcs)" instead of listing every one out.
export function formatSerialRange(serials: string[]): string {
  const list = serials.filter(Boolean);
  if (list.length === 0) return "-";
  if (list.length === 1) return list[0];
  return `${list[0]} – ${list[list.length - 1]} (${list.length} pcs)`;
}

// Purchase request forms (Form A - Inventory/Service, Form B - Expense,
// Form C - Inventory Out, Form D - Stock Request).
export const FORM_A_CODES = ["INVENTORY", "SERVICE"];
export const FORM_D_CODES = ["INVENTORY", "CONSUMABLE"];
export const EXPENSE_CODES: { code: string; label: string }[] = [
  { code: "A", label: "Warehouse & Workshop" },
  { code: "B", label: "Additional Part Expense" },
  { code: "C", label: "Project Expense" },
  { code: "D", label: "Lab Equipment Expense" },
  { code: "E", label: "Packing, Document, Insurance" },
  { code: "F", label: "Office Maintenance Expense" },
  { code: "G", label: "Office Sanitary Expense" },
  { code: "H", label: "Office Stationary Expense" },
  { code: "I", label: "Website, Catalogue, etc" },
  { code: "J", label: "Fixed Asset*" },
  { code: "K", label: "Natura" },
  { code: "L", label: "Exhibition and Seminar Expense" },
  { code: "M", label: "Other Expense" },
];
export const FORM_C_CODES: { code: string; label: string }[] = [
  { code: "A", label: "Warehouse & Workshop" },
  { code: "B", label: "Additional Part Expense" },
  { code: "C", label: "Lab Equipment Expense" },
  { code: "D", label: "Packing, Document, Insurance" },
  { code: "E", label: "Sample & Demo Expense" },
  { code: "F", label: "Reject & Replacement Expense" },
  { code: "G", label: "Fixed Asset Transtation" },
  { code: "H", label: "Website, Catalogue, etc" },
];

export interface PurchaseFormItem {
  id: string;
  description: string;
  budget: number;
  ppn: boolean;
  supplier_name: string;
  code: string;
  attachment_path: string | null;
  attachment_filename: string | null;
  item_code: string;
  qty: number;
  unit: string;
  remarks: string;
}

export type PurchaseFormStatus = "pending_approval" | "approved" | "rejected" | "cancelled";

export interface PurchaseFormHistoryEntry {
  id: string;
  purchase_form_id: string;
  status: string;
  changed_by: string;
  comment: string;
  changed_at: string;
}

export interface PurchaseForm {
  id: string;
  form_type: "A" | "B" | "C" | "D";
  request_date: string;
  name: string;
  customer_name: string;
  po_so_number: string;
  purpose: string;
  status: PurchaseFormStatus;
  current_approval_layer: 1 | 2 | null;
  submitted_by: string;
  source: string | null;
  bom_row_id: string | null;
  job_order_id: string | null;
  registered: boolean;
  created_at: string;
  items: PurchaseFormItem[];
  history: PurchaseFormHistoryEntry[];
}

// Real .xlsx (not the old HTML-table-as-.xls trick) via SheetJS, loaded
// lazily so it's only pulled into the bundle when actually used. One sheet
// per supplier tab category (plus "All") so a workbook opened outside the
// app still mirrors the page's own tab split, instead of one flat sheet.
export async function exportPoOutRecapToExcel(
  filenamePrefix: string,
  rows: PoOut[],
  columns: { key: string; label: string }[],
  cellText: (p: PoOut, key: string) => string,
  suppliers: Supplier[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const supplierCategory = new Map(suppliers.map((s) => [s.name, s.tab_category]));
  const buildSheet = (items: PoOut[]) => {
    const header = columns.map((c) => c.label);
    const body = items.map((p) => columns.map((c) => cellText(p, c.key)));
    return XLSX.utils.aoa_to_sheet([header, ...body]);
  };
  XLSX.utils.book_append_sheet(workbook, buildSheet(rows), "All");
  for (const cat of SUPPLIER_TAB_CATEGORIES) {
    const items = rows.filter((p) => supplierCategory.get(p.supplier) === cat.value);
    if (items.length > 0) XLSX.utils.book_append_sheet(workbook, buildSheet(items), cat.label.slice(0, 31));
  }
  XLSX.writeFile(workbook, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export type SupplierTabCategory = "TEMPSENS" | "ALLEIMA" | "OTHER_INDIA" | "OTHER_IMPORT" | "LOCAL" | "EXPORT" | "STOCK_TAJ";

export const SUPPLIER_TAB_CATEGORIES: { value: SupplierTabCategory; label: string }[] = [
  { value: "TEMPSENS", label: "TEMPSENS" },
  { value: "ALLEIMA", label: "ALLEIMA" },
  { value: "OTHER_INDIA", label: "OTHER (INDIA)" },
  { value: "OTHER_IMPORT", label: "OTHER IMPORT" },
  { value: "LOCAL", label: "LOCAL" },
  { value: "EXPORT", label: "EXPORT" },
  { value: "STOCK_TAJ", label: "STOCK TAJ" },
];

export interface Supplier {
  id: string;
  name: string;
  tab_category: SupplierTabCategory;
  created_at: string;
}

export type Currency = "IDR" | "USD" | "SGD" | "EUR" | "CNY" | "JPY";
export const CURRENCY_SYMBOLS: Record<Currency, string> = { IDR: "Rp", USD: "$", SGD: "SGD", EUR: "€", CNY: "CNY", JPY: "¥" };
export const PO_OUT_STATUSES: { value: PoOutStatus; label: string; color: string }[] = [
  { value: "production", label: "Production", color: "#eab308" },
  { value: "shipment", label: "Shipment", color: "#3b82f6" },
  { value: "arrived", label: "Arrived", color: "#22c55e" },
];

export type PoOutStatus = "production" | "shipment" | "arrived";

export interface PoOutHistoryEntry {
  id: string;
  po_out_id: string;
  changed_by: string;
  comment: string;
  status: PoOutStatus | null;
  changed_at: string;
}

export interface PoOut {
  id: string;
  po_date: string;
  deadline: string | null;
  urgent: boolean;
  po_number: string;
  item_code: string;
  sales: string;
  customer_name: string;
  item_description: string;
  qty: number;
  unit: string;
  unit_price: number;
  unit_price_currency: Currency;
  total_price: number;
  unit_selling_price: number;
  unit_selling_price_currency: Currency;
  supplier: string;
  status: PoOutStatus;
  oc: string;
  origin: string;
  shipment: string;
  submitted_by: string;
  created_at: string;
  history: PoOutHistoryEntry[];
}

export interface Shipment {
  id: string;
  shipment_number: string;
  supplier: string;
  shipment_via: string;
  incoterms: string;
  invoice: string;
  awb_bl: string;
  atd: string | null;
  eta_jkt: string | null;
  sppb: string;
  delivery: string;
  awb_bl_file_path: string | null;
  awb_bl_file_name: string | null;
  photo_paths: string[];
  submitted_by: string;
  created_at: string;
}

// Splits `text` into [before, matched, after] around the first
// case-insensitive occurrence of `term`, for bolding the matched prefix in
// item-code suggestion lists (e.g. typing "TC" bolds "TC" in "TC.12").
export function splitMatch(text: string, term: string): [string, string, string] {
  if (!term) return [text, "", ""];
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return [text, "", ""];
  return [text.slice(0, idx), text.slice(idx, idx + term.length), text.slice(idx + term.length)];
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
export function dashboardStatusLabel(status: JobOrderStatus, currentStation?: string | null, daysSinceFinish?: number): string {
  if (status === "draft" || status === "pending_approval") return "Draft";
  if (status === "approved") return "Approved";
  if (status === "acknowledged") return "Preparing Item";
  if (status === "in_progress" || status === "qc") {
    return currentStation ? `Under Production - ${currentStation} Station` : "Under Production";
  }
  // Still shows for 7 days after finish_date (see /api/dashboard) - the
  // count makes it obvious at a glance how close it is to dropping off.
  if (status === "completed") return daysSinceFinish !== undefined ? `Finish Production (${daysSinceFinish})` : "Finish Production";
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
