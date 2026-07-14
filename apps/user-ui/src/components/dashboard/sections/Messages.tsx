"use client";

import { MessageSquare } from "lucide-react";
import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { EmptyState } from "@/components/dashboard/DashboardUI";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

/**
 * Messages — placeholder honnête (données factices supprimées).
 * TODO chantier messagerie in-app (backlog V2) : conversations par deal,
 * les boutons "Message" des vues booking/carrier s'y brancheront.
 */
export default function Messages({ copy }: { copy: DashboardCopy }) {
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";

  return (
    <>
      <SectionHeader title={copy.messages.title} subtitle={copy.messages.sub} />
      <EmptyState
        icon={MessageSquare}
        title={isFr ? "Aucune conversation" : "No conversations"}
        description={
          isFr
            ? "La messagerie arrive bientôt. Tes échanges avec les Voyageurs et Expéditeurs vivront ici."
            : "Messaging is coming soon. Your conversations with Trippers and Shippers will live here."
        }
      />
    </>
  );
}
