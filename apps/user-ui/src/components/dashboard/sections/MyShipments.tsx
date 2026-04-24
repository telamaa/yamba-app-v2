"use client";

import {DashboardCopy} from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {ListRow, StatCard} from "@/components/dashboard/DashboardUI";

export default function MyShipments({ copy }: { copy: DashboardCopy }) {
  return (
    <>
      <SectionHeader title={copy.shipments.title} subtitle={copy.shipments.sub} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={copy.inTransit} value="1" />
        <StatCard label={copy.delivered} value="8" />
        <StatCard label={copy.spent} value="195€" />
      </div>

      <ListRow
        title="Colis #YMB-4821"
        subtitle="Paris → Marseille · Transporté par Julie D."
        badge={copy.inTransit}
        badgeVariant="active"
      />
      <ListRow
        title="Colis #YMB-3190"
        subtitle="Lyon → Nice · Transporté par Marc R."
        badge={copy.delivered}
        badgeVariant="done"
      />
    </>
  );
}
