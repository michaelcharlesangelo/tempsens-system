import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";
import CostingTables from "@/app/components/CostingTables";
import ApprovalTabView from "@/app/components/ApprovalTabView";
import FormApprovalView from "@/app/components/FormApprovalView";

export default function OperationalManagerPage() {
  return (
    <>
      <SubmittedJobOrders tab="operational-manager" by="Operational Manager" />
      <CostingTables tab="operational-manager" includeToBeCosting={false} filterBySubmitter="Operational Manager" />
      <ApprovalTabView tab="operational-manager" layer={2} label="Operational Manager" />
      <FormApprovalView layer={1} label="Operational Manager" />
    </>
  );
}
