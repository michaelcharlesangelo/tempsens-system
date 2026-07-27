import TabNav from "@/app/components/TabNav";
import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";
import CostingTables from "@/app/components/CostingTables";

export default function SalesSupportPage() {
  return (
    <>
      <TabNav active="/sales-support" />
      <SubmittedJobOrders tab="jo-input" by="Sales Support" />
      <CostingTables tab="jo-input" includeToBeCosting={false} />
    </>
  );
}
