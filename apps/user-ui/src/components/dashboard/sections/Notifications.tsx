"use client";



import {DashboardCopy} from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {ListRow} from "@/components/dashboard/DashboardUI";

export default function Notifications({ copy }: { copy: DashboardCopy }) {
  return (
    <>
      <SectionHeader title={copy.notifications.title} subtitle={copy.notifications.sub} />

      <ListRow
        title="Nouvelle demande sur Paris → Marseille"
        subtitle="Julie D. souhaite envoyer un colis · Il y a 2h"
        badgeVariant="pending"
        highlight
      />
      <ListRow
        title="Paiement reçu"
        subtitle="45€ pour le trajet Lyon → Nice · Il y a 5h"
        badgeVariant="pending"
        highlight
      />
      <ListRow
        title="Colis #YMB-3190 livré"
        subtitle="Marc R. a confirmé la réception · Hier"
        badgeVariant="done"
      />
      <ListRow
        title="Avis laissé"
        subtitle="Sofia B. vous a laissé 5 étoiles · 3j"
        badgeVariant="done"
      />
    </>
  );
}
