"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import useUser from "@/hooks/useUser";
import {DashboardCopy} from "@/app/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {CardSection, EmptyState, InfoBanner, SettingRow} from "@/components/dashboard/DashboardUI";


export default function BecomeYamber({ copy }: { copy: DashboardCopy }) {
  const { user } = useUser();
  const router = useRouter();

  const hasCarrier = user?.roles?.includes("CARRIER");
  const carrierPage = user?.carrierPage;

  return (
    <>
      <SectionHeader title={copy.yamber.title} subtitle={copy.yamber.sub} />

      {hasCarrier && carrierPage ? (
        <>
          <InfoBanner icon={Globe} text={copy.onboardingDone} />

          <CardSection>
            <SettingRow
              label="Nom du profil"
              description={carrierPage.name ?? "—"}
              actionLabel={copy.edit}
            />
            <SettingRow
              label="Bio"
              description={carrierPage.bio ?? "—"}
              actionLabel={copy.edit}
            />
            <SettingRow
              label="Adresse principale"
              description="—"
              actionLabel={copy.edit}
            />
            <SettingRow
              label="Stripe Connect"
              description={carrierPage.stripeAccountId ? "Compte actif" : "Non configuré"}
              actionLabel={copy.manage}
            />
          </CardSection>
        </>
      ) : (
        <EmptyState
          icon={Globe}
          title={copy.yamber.title}
          description={copy.yamber.sub}
          actionLabel={copy.yamber.title}
          onAction={() => router.push("/carrier/onboarding")}
        />
      )}
    </>
  );
}
