"use client";

/**
 * Messages — la messagerie du tableau de bord (chantier F, D61 / F-PR2)
 * =====================================================================
 * Deux colonnes sur grand écran (liste + fil), une seule sur mobile (la liste laisse la place
 * au fil, retour par la flèche). Le placeholder « la messagerie arrive bientôt » est remplacé.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import ConversationsList from "@/components/dashboard/messages/ConversationsList";
import ConversationThread from "@/components/dashboard/messages/ConversationThread";
import { useConversations } from "@/hooks/useMessaging";

export default function Messages({ copy }: { copy: DashboardCopy }) {
  const t = useTranslations("messaging");
  const searchParams = useSearchParams();
  const { data, isLoading } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // ?focus=phone (bouton « Appeler » d'un écran de deal, A137) : le fil met le numéro en avant.
  const focusPhone = searchParams?.get("focus") === "phone";

  // Ouverture directe depuis un écran de deal : ?conversation=<id>
  useEffect(() => {
    const wanted = searchParams?.get("conversation");
    if (wanted) setSelectedId(wanted);
  }, [searchParams]);

  // Sur grand écran, on ouvre le premier fil pour ne pas laisser une colonne vide.
  useEffect(() => {
    if (!selectedId && data?.items.length && typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSelectedId(data.items[0].id);
    }
  }, [data, selectedId]);

  return (
    <>
      <SectionHeader title={copy.messages.title} subtitle={copy.messages.sub} />
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className={`border-slate-200 dark:border-slate-800 lg:border-r ${selectedId ? "hidden lg:block" : "block"}`}>
            {isLoading ? (
              <p className="p-6 text-[13px] text-slate-500 dark:text-slate-400">{t("loading")}</p>
            ) : (
              <ConversationsList items={data?.items ?? []} selectedId={selectedId} onSelectAction={setSelectedId} />
            )}
          </div>
          <div className={selectedId ? "block" : "hidden lg:block"}>
            {selectedId ? (
              <ConversationThread conversationId={selectedId} focusPhone={focusPhone} onBack={() => setSelectedId(null)} />
            ) : (
              <p className="p-8 text-center text-[13px] text-slate-500 dark:text-slate-400">{t("selectOne")}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
