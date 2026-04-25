"use client";



import {DashboardCopy} from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {ListRow, StatCard} from "@/components/dashboard/DashboardUI";

export default function Payments({ copy }: { copy: DashboardCopy }) {
  return (
    <>
      <SectionHeader title={copy.payments.title} subtitle={copy.payments.sub} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={copy.received} value="340€" change={`+18% ${copy.thisMonth}`} />
        <StatCard label={copy.spent} value="195€" />
        <StatCard label={copy.pending} value="45€" />
      </div>

      <ListRow
        title="+45,00€"
        subtitle="Trajet Lyon → Nice · Marc R. · 5 avril"
        badge={copy.received}
        badgeVariant="active"
      />
      <ListRow
        title="-25,00€"
        subtitle="Envoi Paris → Marseille · Julie D. · 3 avril"
        badge={copy.inProgress}
        badgeVariant="pending"
      />
    </>
  );
}
