import SettingsTabs from "./settings-tabs";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Global settings shared by every website and service.
        </p>
      </div>
      <SettingsTabs initialTab={typeof tab === "string" ? tab : "email"} />
    </div>
  );
}
