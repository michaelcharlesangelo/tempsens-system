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
  { layer: 2, tab: "operation-manager", label: "Operation Manager" },
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
  quantity: number;
  item_no: string;
  sales_person_name: string;
  deadline: string | null;
  urgent: boolean;
  po_attachment_path?: string | null; // omitted by the API for unauthorized tabs
  serial_no: string;
  finish_estimation: string | null;
  finish_date: string | null;
  barcode: string | null;
  status: JobOrderStatus;
  current_approval_layer: 1 | 2 | 3 | null;
  created_at: string;
  approved_at: string | null;
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
  created_at: string;
}

export interface StationCode {
  id: string;
  code: string;
  station_name: string;
  description: string;
  sequence: number;
  active: boolean;
  created_at: string;
}

export interface ProductionLog {
  id: string;
  job_order_id: string;
  station_id: string;
  scanned_by: string;
  scanned_at: string;
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

export interface ProductionAccount {
  id: string;
  username: string;
  full_name: string;
}

export interface SalesPerson {
  id: string;
  name: string;
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
