/**
 * DealRequestClient.tsx
 * =====================
 * Router client-side entre Desktop et Mobile. Pour le MVP, utilise
 * mockDealRequest peu importe le dealId. À brancher sur getDealRequest()
 * + React Query dans la PR backend.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { getDealRequest } from "./deal-request.api";
import type { DealRequest } from "./deal-request.types";
import DealRequestDesktop from "./DealRequestDesktop";
import DealRequestMobile from "./DealRequestMobile";
import DealRequestSkeleton from "./DealRequestSkeleton";

type Props = {
  dealId: string;
};

export default function DealRequestClient({ dealId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [deal, setDeal] = useState<DealRequest | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Fetch (mock pour l'instant)
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
    // Pour l'instant on revient vers la home. Plus tard ce sera
    // /carrier/deals (inbox) ou le détail trajet d'origine.
    router.push("/");
  }, [router]);

  if (isMobile === null || (!deal && !loadError)) {
    return <DealRequestSkeleton />;
  }

  if (loadError) {
    return <DealRequestError onBackAction={handleClose} />;
  }

  if (!deal) {
    return <DealRequestSkeleton />;
  }

  if (isMobile) {
    return <DealRequestMobile deal={deal} onCloseAction={handleClose} />;
  }

  return <DealRequestDesktop deal={deal} onCloseAction={handleClose} />;
}

function DealRequestError({ onBackAction }: { onBackAction: () => void }) {
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
