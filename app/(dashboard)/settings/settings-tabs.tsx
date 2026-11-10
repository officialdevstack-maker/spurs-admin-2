"use client";

import * as React from "react";
import { Mail, SlidersHorizontal } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import EmailSettingsForm from "./email-settings-form";

function GeneralPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Site name, support contact and other shared options.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Nothing to configure yet.</p>
      </CardContent>
    </Card>
  );
}

const TABS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "general", label: "General", icon: SlidersHorizontal },
] as const;

type SettingsTab = (typeof TABS)[number]["value"];

function isSettingsTab(value: string): value is SettingsTab {
  return TABS.some((tab) => tab.value === value);
}

export default function SettingsTabs({ initialTab }: { initialTab: string }) {
  const [tab, setTab] = React.useState<SettingsTab>(
    isSettingsTab(initialTab) ? initialTab : "email",
  );

  function changeTab(value: string | number | undefined) {
    const next = String(value);
    if (!isSettingsTab(next)) return;

    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={changeTab}>
      <TabsList>
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value}>
            <Icon />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="email">
        <EmailSettingsForm />
      </TabsContent>
      <TabsContent value="general">
        <GeneralPlaceholder />
      </TabsContent>
    </Tabs>
  );
}
