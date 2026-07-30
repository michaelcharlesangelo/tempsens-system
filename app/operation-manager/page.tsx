import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";
import CostingTables from "@/app/components/CostingTables";
import ApprovalTabView from "@/app/components/ApprovalTabView";

export default function OperationManagerPage() {
  return (
    <>
      <SubmittedJobOrders tab="operation-manager" by="Operational Manager" />
      <CostingTables tab="operation-manager" includeToBeCosting={false} filterBySubmitter="Operational Manager" />
      <ApprovalTabView tab="operation-manager" layer={2} label="Operational Manager" />
    </>
  );
}
