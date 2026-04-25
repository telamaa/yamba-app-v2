"use client";


import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import {DashboardCopy} from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {CardSection, SettingRow, ToggleRow} from "@/components/dashboard/DashboardUI";


export default function SettingsSection({ copy }: { copy: DashboardCopy }) {
  const { lang } = useUiPreferences();

  return (
    <>
      <SectionHeader title={copy.settings.title} subtitle={copy.settings.sub} />

      <CardSection>
        <SettingRow
          label={copy.language}
          description={lang === "fr" ? "Français" : "English"}
          actionLabel={copy.change}
        />
        <SettingRow
          label={copy.theme}
          description={copy.themeSub}
          actionLabel={copy.change}
        />
        <ToggleRow label={copy.emailNotif} description={copy.emailNotifSub} defaultOn />
        <ToggleRow label={copy.pushNotif} description={copy.pushNotifSub} />
      </CardSection>
    </>
  );
}
