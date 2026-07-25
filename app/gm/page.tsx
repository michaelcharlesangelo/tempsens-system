import TabNav from "@/app/components/TabNav";
import ApprovalTabView from "@/app/components/ApprovalTabView";

export default function GmPage() {
  return (
    <>
      <TabNav active="/gm" />
      <ApprovalTabView tab="gm" layer={3} label="General Manager" />
    </>
  );
}
