import TabNav from "@/app/components/TabNav";
import ApprovalTabView from "@/app/components/ApprovalTabView";

export default function OperationManagerPage() {
  return (
    <>
      <TabNav active="/operation-manager" />
      <ApprovalTabView tab="operation-manager" layer={2} label="Operation Manager" />
    </>
  );
}
