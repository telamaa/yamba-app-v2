"use client";



import SectionHeader from "@/components/dashboard/SectionHeader";
import {DashboardCopy} from "@/app/dashboard/dashboard.copy";
import {ListRow} from "@/components/dashboard/DashboardUI";

export default function Messages({ copy }: { copy: DashboardCopy }) {
  return (
    <>
      <SectionHeader title={copy.messages.title} subtitle={copy.messages.sub} />

      <ListRow
        title="Julie Dupont"
        subtitle="Super, je vous envoie les détails du colis · 2h"
        avatar="JD"
        avatarBg="#0F766E"
        rightBadge={1}
      />
      <ListRow
        title="Marc Robert"
        subtitle="Colis bien reçu, merci beaucoup ! · 1j"
        avatar="MR"
        avatarBg="#534AB7"
        rightBadge={1}
      />
      <ListRow
        title="Sofia Benali"
        subtitle="D'accord pour le 18 avril · 3j"
        avatar="SB"
        avatarBg="#D85A30"
      />
    </>
  );
}
