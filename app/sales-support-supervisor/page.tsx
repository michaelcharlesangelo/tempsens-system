import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";
import CostingTables from "@/app/components/CostingTables";

export default function SalesSupportSupervisorPage() {
  return (
    <>
      <SubmittedJobOrders tab="sales-support-supervisor" by="Sales Support Supervisor" defaultOpen pageSize={3} />
      <CostingTables tab="sales-support-supervisor" />
    </>
  );
}
