"use client";

import { Wallet } from "lucide-react";
import {DashboardCopy} from "@/app/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {EmptyState} from "@/components/dashboard/DashboardUI";


export default function WalletSection({ copy }: { copy: DashboardCopy }) {
  return (
    <>
      <SectionHeader title={copy.wallet.title} subtitle={copy.wallet.sub} />
      <EmptyState
        icon={Wallet}
        title="Stripe Connect"
        description={copy.stripeDesc}
        actionLabel={copy.openStripe}
      />
    </>
  );
}
