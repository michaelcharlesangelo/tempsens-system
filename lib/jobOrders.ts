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

// The 3 sequential approval layers, and which role is responsible for each.
export const APPROVAL_LAYERS: { layer: 1 | 2 | 3; role: string; label: string }[] = [
  { layer: 1, role: "sales_manager", label: "Sales Manager" },
  { layer: 2, role: "operational_manager", label: "Operational Manager" },
  { layer: 3, role: "gm_md", label: "GM / MD" },
];

// Roles allowed to see the PO attachment - production/workshop must not.
export const PO_VISIBLE_ROLES = ["admin", "sales_support", "sales_manager", "operational_manager", "gm_md"];

export interface JobOrder {
  id: string;
  jo_number: string;
  customer_name: string;
  so_no: string;
  item_category: string;
  item_description: string;
  drawing_url: string | null;
  quantity: number;
  item_code: string;
  serial_no: string;
  deadline: string | null;
  finish_date: string | null;
  po_attachment_url?: string | null; // omitted by the API for non-approval roles
  barcode: string | null;
  status: JobOrderStatus;
  current_approval_layer: 1 | 2 | 3 | null;
  material_issued: boolean;
  material_issued_at: string | null;
  created_by: string;
  acknowledged_by: string | null;
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
  item_code: string;
  description: string;
  estimated_qty: number;
  actual_qty: number;
  unit: string;
  created_at: string;
}

export type PurchaseRequestStatus = "pending" | "approved" | "rejected" | "ordered" | "received";

export interface PurchaseRequest {
  id: string;
  job_order_id: string;
  bom_item_id: string | null;
  item_name: string;
  quantity: number;
  status: PurchaseRequestStatus;
  requested_by: string;
  approver_id: string | null;
  notes: string;
  created_at: string;
  resolved_at: string | null;
}

export type QcResult = "pending" | "pass" | "fail";

export interface QcRecord {
  id: string;
  job_order_id: string;
  performed_by: string;
  result: QcResult;
  calibration_data: Record<string, unknown>;
  report_notes: string;
  performed_at: string;
}

export interface ItemCategory {
  id: string;
  name: string;
}

export interface ItemCatalogEntry {
  item_code: string;
  description: string;
  category: string | null;
}

export interface StationCode {
  id: string;
  code: string;
  station_name: string;
  description: string;
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

// Generates the next JO number for the current year, e.g. JO-2026-0001.
export function generateJoNumber(existingCountThisYear: number): string {
  const year = new Date().getFullYear();
  const seq = String(existingCountThisYear + 1).padStart(4, "0");
  return `JO-${year}-${seq}`;
}

// Generates a short random unique code for QR content (job orders and
// station codes both use this).
export function generateShortCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}
