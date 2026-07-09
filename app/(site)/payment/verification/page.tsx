import VerificationClient from "../../paiement/verification/VerificationClient";

export default function PaymentVerificationPage({
  searchParams,
}: {
  searchParams?: {
    type?: string;
    status?: string;
    orderNumber?: string;
    order_number?: string;
    order?: string;
    reference?: string;
  };
}) {
  const orderNumber =
    searchParams?.orderNumber ||
    searchParams?.order_number ||
    searchParams?.order ||
    searchParams?.reference ||
    "";

  return (
    <VerificationClient
      orderNumber={orderNumber}
      type={searchParams?.type}
      status={searchParams?.status}
    />
  );
}
