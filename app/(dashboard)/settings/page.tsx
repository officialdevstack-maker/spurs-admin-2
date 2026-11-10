import EmailSettingsForm from "./email-settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Global settings shared by every website and service.
        </p>
      </div>
      <EmailSettingsForm />
    </div>
  );
}
