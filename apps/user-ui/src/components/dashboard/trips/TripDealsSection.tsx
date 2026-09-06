"use client";

/**
 * TripDealsSection.tsx — « Demandes et colis » d'UN trajet (page propriétaire)
 * ============================================================================
 * Même source que « Mes trajets » (GET /me/deals, filtré par tripId — A44),
 * mêmes lignes (TripDealRow). Une seule colonne, mobile-first.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import { useMyDeals } from "@/hooks/useMyDeals";
import { groupDealsByTrip, countPending } from "./my-deals.adapter";
import TripDealRow from "./TripDealRow";

const MANGO = "#FF9900";

export default function TripDealsSection({ tripId }: { tripId: string }) {
  const t = useTranslations("myTrips");
  const { data: dealViews, isLoading } = useMyDeals();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const deals = useMemo(
    () => groupDealsByTrip(dealViews ?? []).get(tripId) ?? [],
    [dealViews, tripId]
  );
  const pending = countPending(deals);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Inbox size={15} className="text-slate-400" />
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
          {t("list.deals.title")}
        </h2>
        {pending > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "rgba(255,153,0,0.10)", color: MANGO }}
          >
            {t("list.demands", { count: pending })}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <p className="text-[12.5px] text-slate-400 dark:text-slate-500">{t("list.deals.empty")}</p>
      ) : (
        <div className="-mx-2">
          {deals.map((deal) => (
            <TripDealRow key={deal.id} deal={deal} nowMs={nowMs} />
          ))}
        </div>
      )}
    </section>
  );
}
