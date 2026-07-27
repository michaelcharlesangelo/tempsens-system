import TabNav from "@/app/components/TabNav";
import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";
import CostingTables from "@/app/components/CostingTables";
import ApprovalTabView from "@/app/components/ApprovalTabView";

export default function OperationManagerPage() {
  return (
    <>
      <TabNav active="/operation-manager" />
      <SubmittedJobOrders tab="operation-manager" by="Operational Manager" />
      <CostingTables tab="operation-manager" />
      <ApprovalTabView tab="operation-manager" layer={2} label="Operational Manager" />
    </>
  );
}
