"use client";



import {DashboardCopy} from "@/app/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {CardSection, SettingRow, ToggleRow} from "@/components/dashboard/DashboardUI";

export default function Security({ copy }: { copy: DashboardCopy }) {
  return (
    <>
      <SectionHeader title={copy.security.title} subtitle={copy.security.sub} />

      <CardSection>
        <SettingRow
          label={copy.password}
          description={copy.passwordSub}
          actionLabel={copy.change}
        />
        <ToggleRow label={copy.twoFa} description={copy.twoFaSub} />
        <SettingRow
          label={copy.activeSessions}
          description={copy.activeSessionsSub}
          actionLabel={copy.manage}
        />
      </CardSection>

      <CardSection>
        <ToggleRow label={copy.publicProfile} description={copy.publicProfileSub} defaultOn />
        <ToggleRow label={copy.showCity} description={copy.showCitySub} defaultOn />
      </CardSection>
    </>
  );
}
