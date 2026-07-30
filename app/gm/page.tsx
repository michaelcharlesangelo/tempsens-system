import ApprovalTabView from "@/app/components/ApprovalTabView";
import FormApprovalView from "@/app/components/FormApprovalView";

export default function GmPage() {
  return (
    <>
      <FormApprovalView layer={2} label="General Manager" />
      <ApprovalTabView tab="gm" layer={3} label="General Manager" />
    </>
  );
}
