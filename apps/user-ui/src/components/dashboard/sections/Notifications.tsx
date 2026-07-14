"use client";

import { Bell } from "lucide-react";
import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { EmptyState } from "@/components/dashboard/DashboardUI";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

/**
 * Notifications — placeholder honnête (données factices supprimées).
 * TODO chantier backend deals : alimenté par les événements de la state
 * machine (demande reçue, pickup confirmé, code disponible, livraison,
 * versement, invitations notation — spec fonctionnelle §10).
 */
export default function Notifications({ copy }: { copy: DashboardCopy }) {
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";

  return (
    <>
      <SectionHeader
        title={copy.notifications.title}
        subtitle={copy.notifications.sub}
      />
      <EmptyState
        icon={Bell}
        title={isFr ? "Aucune notification" : "No notifications"}
        description={
          isFr
            ? "Les événements de tes envois et trajets apparaîtront ici : demandes, prises en charge, livraisons, versements."
            : "Events from your shipments and trips will appear here: requests, pickups, deliveries, payouts."
        }
      />
    </>
  );
}
