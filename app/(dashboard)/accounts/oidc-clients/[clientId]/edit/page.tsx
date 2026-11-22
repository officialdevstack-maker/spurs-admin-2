import { OidcClientEditPage } from "../../oidc-client-form";

export default async function EditOidcClientRoute({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <OidcClientEditPage clientId={clientId} />;
}
