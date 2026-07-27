import TabNav from "@/app/components/TabNav";
import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";

export default function SalesSupportPage() {
  return (
    <>
      <TabNav active="/sales-support" />
      <SubmittedJobOrders tab="jo-input" by="Sales Support" />
    </>
  );
}
