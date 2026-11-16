import PayProviderSettingsForm from "./pay-provider-settings-form";

export default function PayProvidersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pay providers</h2>
        <p className="text-sm text-muted-foreground">
          Manage the payment provider and credentials used by Spurs Pay.
        </p>
      </div>
      <PayProviderSettingsForm />
    </div>
  );
}
