import ApprovalTabView from "@/app/components/ApprovalTabView";
import FormApprovalView from "@/app/components/FormApprovalView";

export default function GeneralManagerPage() {
  return (
    <>
      <FormApprovalView layer={2} label="General Manager" />
      <ApprovalTabView tab="general-manager" layer={3} label="General Manager" />
    </>
  );
}
