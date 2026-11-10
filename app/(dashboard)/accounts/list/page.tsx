import AccountsList from "./accounts-list";

export default async function AccountsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return <AccountsList initialStatus={status === "suspended" ? "suspended" : "all"} />;
}
