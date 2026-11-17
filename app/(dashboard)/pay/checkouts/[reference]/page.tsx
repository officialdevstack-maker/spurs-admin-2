import CheckoutDetail from "./checkout-detail";

export default async function PayCheckoutDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <CheckoutDetail reference={reference} />;
}
