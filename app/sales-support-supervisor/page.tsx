import TabNav from "@/app/components/TabNav";
import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";
import CostingTables from "@/app/components/CostingTables";

export default function SalesSupportSupervisorPage() {
  return (
    <>
      <TabNav active="/sales-support-supervisor" />
      <SubmittedJobOrders tab="sales-support-supervisor" by="Sales Support Supervisor" />
      <CostingTables tab="sales-support-supervisor" />
    </>
  );
}
