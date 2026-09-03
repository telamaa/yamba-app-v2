/**
 * DealClient.tsx
 * ==============
 * Orchestrateur principal du module Deal côté Voyageur.
 * Charge le Deal (GET /deals/:id — vue Carrier réelle, B2) puis switch
 * sur le statut pour rendre la bonne view :
 *   PENDING   → DealRequestDesktop/Mobile
 *   ACCEPTED  → DealAcceptedDesktop/Mobile
 *   PICKED_UP → DealTrackingClient (suivi du voyage)
 *   terminaux → DealClosed (la demande n'est plus actionnable)
 *
 * Cache TanStack Query ["deal", dealId] : après un accept/decline la view
 * invalide la clé et cette page re-render depuis le SERVEUR (jamais une
 * mutation locale du statut — le front reflète, ne décide jamais).
 *
 * L'URL reste stable : /carrier/deals/[dealId]
 */

"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { getDealRequest } from "./deal.api";
import DealSkeleton from "./DealSkeleton";
import DealRequestDesktop from "./views/request/DealRequestDesktop";
import DealRequestMobile from "./views/request/DealRequestMobile";
import DealAcceptedDesktop from "./views/accepted/DealAcceptedDesktop";
import DealAcceptedMobile from "./views/accepted/DealAcceptedMobile";
import DealSettledView from "./views/settled/DealSettledView";
import DealTrackingClient from "./views/tracking/DealTrackingClient";

type Props = {
  dealId: string;
};

export const dealQueryKey = (dealId: string) => ["deal", dealId] as const;

export default function DealClient({ dealId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: deal,
    isError,
  } = useQuery({
    queryKey: dealQueryKey(dealId),
    queryFn: () => getDealRequest(dealId),
    staleTime: 30_000,
    retry: 1,
  });

  const handleClose = useCallback(() => {
    router.push("/");
  }, [router]);

  /** Après une transition la vérité est en base : on relit, on ne mute pas. */
  const handleTransitioned = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: dealQueryKey(dealId) });
  }, [queryClient, dealId]);

  if (isMobile === null || (!deal && !isError)) {
    return <DealSkeleton />;
  }

  if (isError || !deal) {
    return <DealError onBackAction={handleClose} />;
  }

  // Statut PICKED_UP → vue tracking (suivi du voyage)
  // DealTrackingClient gère lui-même le switch desktop/mobile
  if (deal.status === "PICKED_UP") {
    return <DealTrackingClient deal={deal} onCloseAction={handleClose} />;
  }

  // Statuts post-acceptation encore « vivants » côté Voyageur
  if (deal.status === "ACCEPTED") {
    return isMobile ? (
      <DealAcceptedMobile deal={deal} onCloseAction={handleClose} />
    ) : (
      <DealAcceptedDesktop deal={deal} onCloseAction={handleClose} />
    );
  }

  // B4-PR3 (A75–A78) : après la remise, le Voyageur lit l'état de SON argent.
  if (deal.status === "DELIVERED" || deal.status === "COMPLETED" || deal.status === "DISPUTED") {
    return <DealSettledView deal={deal} variant={isMobile ? "mobile" : "desktop"} onCloseAction={handleClose} />;
  }

  // Terminaux (DECLINED, EXPIRED, CANCELLED) : plus rien à décider ici —
  // écran de clôture sobre.
  if (deal.status !== "PENDING") {
    return <DealClosed status={deal.status} onBackAction={handleClose} />;
  }

  // Statut PENDING → vues request
  return isMobile ? (
    <DealRequestMobile
      deal={deal}
      onCloseAction={handleClose}
      onAcceptedAction={handleTransitioned}
    />
  ) : (
    <DealRequestDesktop
      deal={deal}
      onCloseAction={handleClose}
      onAcceptedAction={handleTransitioned}
    />
  );
}

function DealError({ onBackAction }: { onBackAction: () => void }) {
  const t = useTranslations("carrierDealRequest");
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-slate-950">
      <div className="max-w-sm text-center">
        <p className="text-[14px] text-slate-600 dark:text-slate-400">
          {t("loadError")}
        </p>
        <button
          type="button"
          onClick={onBackAction}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[#FF9900] px-5 py-2 text-[13px] font-bold text-slate-950 hover:bg-[#F08700]"
        >
          {t("back")}
        </button>
      </div>
    </div>
  );
}

function DealClosed({
  status,
  onBackAction,
}: {
  status: string;
  onBackAction: () => void;
}) {
  const t = useTranslations("carrierDealRequest");
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-slate-950">
      <div className="max-w-sm text-center">
        <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
          {t(`closed.${status}` as Parameters<typeof t>[0])}
        </p>
        <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
          {t("closed.hint")}
        </p>
        <button
          type="button"
          onClick={onBackAction}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t("back")}
        </button>
      </div>
    </div>
  );
}
