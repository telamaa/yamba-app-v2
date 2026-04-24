"use client";



import {DashboardCopy} from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {ListRow, StatCard} from "@/components/dashboard/DashboardUI";

export default function MyTrips({ copy }: { copy: DashboardCopy }) {
  return (
    <>
      <SectionHeader title={copy.trips.title} subtitle={copy.trips.sub} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={copy.active} value="3" />
        <StatCard label={copy.completed} value="12" />
        <StatCard label={copy.draft} value="1" />
        <StatCard label={copy.revenue} value="340€" change={`+18% ${copy.thisMonth}`} />
      </div>

      <ListRow
        title="Paris → Marseille"
        subtitle="12 avril 2026 · Train · 2 demandes"
        badge={copy.active}
        badgeVariant="active"
      />
      <ListRow
        title="Lyon → Bordeaux"
        subtitle="18 avril 2026 · Voiture · 1 demande"
        badge={copy.active}
        badgeVariant="active"
      />
      <ListRow
        title="Paris → Dakar"
        subtitle="25 avril 2026 · Avion · 0 demandes"
        badge={copy.pending}
        badgeVariant="pending"
      />
      <ListRow
        title="Nice → Toulouse"
        subtitle="2 mars 2026 · Train · 3 livrés"
        badge={copy.completed}
        badgeVariant="done"
      />
    </>
  );
}
