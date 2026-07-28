import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";
import CostingTables from "@/app/components/CostingTables";

export default function SalesSupportPage() {
  return (
    <>
      <SubmittedJobOrders tab="jo-input" by="Sales Support" />
      <CostingTables tab="jo-input" includeToBeCosting={false} />
    </>
  );
}
