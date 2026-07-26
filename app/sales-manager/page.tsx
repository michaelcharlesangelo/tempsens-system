import TabNav from "@/app/components/TabNav";
import ApprovalTabView from "@/app/components/ApprovalTabView";

export default function SalesManagerPage() {
  return (
    <>
      <TabNav active="/sales-manager" />
      <ApprovalTabView tab="sales-manager" layer={1} label="Sales Manager" />
    </>
  );
}
