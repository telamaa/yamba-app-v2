/**
 * DealClient.tsx
 * ==============
 * Orchestrateur principal du module Deal côté Voyageur.
 * Charge le Deal puis switch sur le statut pour rendre la bonne view :
 *   PENDING   → DealRequestDesktop/Mobile
 *   ACCEPTED  → DealAcceptedDesktop/Mobile (Phase 2)
 *
 * L'URL reste stable : /carrier/deals/[dealId]
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { getDealRequest } from "./deal.api";
import type { DealRequest } from "./deal.types";
import DealSkeleton from "./DealSkeleton";
import DealRequestDesktop from "./views/request/DealRequestDesktop";
import DealRequestMobile from "./views/request/DealRequestMobile";

type Props = {
  dealId: string;
};

export default function DealClient({ dealId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [deal, setDeal] = useState<DealRequest | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDeal(null);
    setLoadError(false);
    getDealRequest(dealId)
      .then((d) => {
        if (!cancelled) setDeal(d);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const handleClose = useCallback(() => {
    router.push("/");
  }, [router]);

  // Après acceptation : on mute localement le status et on switch de view.
  // Plus tard avec le backend, ce sera un refetch React Query.
  const handleAccepted = useCallback((acceptedDeal: DealRequest) => {
    setDeal({ ...acceptedDeal, status: "ACCEPTED" });
  }, []);

  if (isMobile === null || (!deal && !loadError)) {
    return <DealSkeleton />;
  }

  if (loadError) {
    return <DealError onBackAction={handleClose} />;
  }

  if (!deal) {
    return <DealSkeleton />;
  }

  // TODO Phase 2 : ajouter le switch case "ACCEPTED" → DealAcceptedDesktop/Mobile
  // Pour l'instant, on log et on reste sur le skeleton si ACCEPTED
  if (deal.status === "ACCEPTED") {
    // eslint-disable-next-line no-console
    console.info("[deal] Status ACCEPTED — DealAcceptedView pas encore implémentée (Phase 2)");
    return <DealSkeleton />;
  }

  return isMobile ? (
    <DealRequestMobile
      deal={deal}
      onCloseAction={handleClose}
      onAcceptedAction={handleAccepted}
    />
  ) : (
    <DealRequestDesktop
      deal={deal}
      onCloseAction={handleClose}
      onAcceptedAction={handleAccepted}
    />
  );
}

function DealError({ onBackAction }: { onBackAction: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-slate-950">
      <div className="max-w-sm text-center">
        <p className="text-[14px] text-slate-600 dark:text-slate-400">
          Cette demande n'existe pas ou a déjà été traitée.
        </p>
        <button
          type="button"
          onClick={onBackAction}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[#FF9900] px-5 py-2 text-[13px] font-bold text-slate-950 hover:bg-[#F08700]"
        >
          Retour
        </button>
      </div>
    </div>
  );
}
