"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Package } from "lucide-react";
import { toast } from "sonner";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { EmptyState } from "@/components/dashboard/DashboardUI";
import CancelShipmentModal from "./CancelShipmentModal";
import ShipmentRow from "./ShipmentRow";
import ShipmentsSkeleton from "./ShipmentsSkeleton";
import { cancelShipment, getMyShipments, getMyShipmentsPreview } from "./shipments.api";
import {
  getShipmentPresentation,
  type ShipmentGroup,
  type ShipmentListItem,
} from "./shipments.types";

type Filter = "all" | ShipmentGroup;

const GROUP_ORDER: ShipmentGroup[] = ["action", "ongoing", "done"];

const GROUP_DOT_CLASSES: Record<ShipmentGroup, string> = {
  action: "bg-amber-400",
  ongoing: "bg-teal-600",
  done: "bg-slate-300 dark:bg-slate-600",
};

export default function ShipmentsClient({
                                          source = "live",
                                        }: {
  source?: "live" | "preview";
}) {
  const t = useTranslations("shipments");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<ShipmentListItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cancelTarget, setCancelTarget] = useState<ShipmentListItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  /* Chargement avec garde d'annulation (pattern projet) */
  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    (source === "preview" ? getMyShipmentsPreview() : getMyShipments())
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  /* Annulation Expéditeur (B2) : le serveur décide du montant et de la
     légalité de la transition ; après succès on RELIT la liste (jamais
     une mutation locale du statut). */
  const handleCancelConfirm = useCallback(
    async (item: ShipmentListItem) => {
      if (source === "preview") {
        // Vitrine QA : jamais d'appel réel.
        toast.success(t("cancel.toastSuccess"));
        setCancelTarget(null);
        return;
      }
      setIsCancelling(true);
      try {
        const result = await cancelShipment(item.id);
        const refund =
          result.refundAmountCents != null
            ? new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
              style: "currency",
              currency: result.currencyCode,
            }).format(result.refundAmountCents / 100)
            : null;
        toast.success(
          refund
            ? t("cancel.toastSuccessRefund", { refund })
            : t("cancel.toastSuccess"),
          { duration: 6000 }
        );
        setCancelTarget(null);
        setItems(await getMyShipments());
      } catch {
        // 409 inclus : le deal a changé entre-temps — on recharge et on ferme.
        toast.error(t("cancel.toastError"));
        setCancelTarget(null);
        try {
          setItems(await getMyShipments());
        } catch {
          /* la liste affichée reste valable */
        }
      } finally {
        setIsCancelling(false);
      }
    },
    [locale, t, source]
  );

  /* Tick 60s pour les countdowns (jamais plus fréquent) */
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  /* Groupement piloté par la machine d'état */
  const grouped = useMemo(() => {
    const map: Record<ShipmentGroup, ShipmentListItem[]> = {
      action: [],
      ongoing: [],
      done: [],
    };
    for (const item of items ?? []) {
      map[getShipmentPresentation(item).group].push(item);
    }
    return map;
  }, [items]);

  const ongoingCount = grouped.action.length + grouped.ongoing.length;
  const doneCount = grouped.done.length;
  const totalCount = ongoingCount + doneCount;

  const visibleGroups = GROUP_ORDER.filter(
    (group) =>
      (filter === "all" || filter === group) && grouped[group].length > 0
  );

  /* ── Rendus ─────────────────────────────────────────────────────── */

  const header = (
    <SectionHeader
      title={t("title")}
      subtitle={t("subtitle", { ongoing: ongoingCount, done: doneCount })}
    />
  );

  if (loadError) {
    return (
      <>
        {header}
        <div className="rounded-lg bg-white px-4 py-6 text-center text-[13px] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          {t("loadError")}
        </div>
      </>
    );
  }

  if (items === null) {
    return (
      <>
        <SectionHeader title={t("title")} subtitle={" "} />
        <ShipmentsSkeleton />
      </>
    );
  }

  if (totalCount === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Package}
          title={t("empty.title")}
          description={t("empty.subtitle")}
          actionLabel={t("empty.cta")}
          onAction={() => router.push("/search")}
        />
      </>
    );
  }

  const chipBase =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors ";
  const chipInactive =
    "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 " +
    "dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white";
  const chipActive =
    "border-slate-900 bg-slate-900 text-white " +
    "dark:border-white dark:bg-white dark:text-slate-900";

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filters.all"), count: totalCount },
    { key: "action", label: t("filters.action"), count: grouped.action.length },
    { key: "ongoing", label: t("filters.ongoing"), count: grouped.ongoing.length },
    { key: "done", label: t("filters.done"), count: doneCount },
  ];

  return (
    <>
      {header}

      {/* Filtres */}
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={chipBase + (filter === f.key ? chipActive : chipInactive)}
          >
            {f.label}
            <span className="ml-1.5 opacity-60">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Groupes */}
      {visibleGroups.map((group) => (
        <section key={group} className="mb-7">
          <div className="mb-2 flex items-center gap-2 px-0.5">
            <span
              className={
                "h-1.5 w-1.5 rounded-full " + GROUP_DOT_CLASSES[group]
              }
            />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group === "action"
                ? t("groups.action")
                : group === "ongoing"
                  ? t("groups.ongoing")
                  : t("groups.done")}
            </h2>
            <span className="text-[11px] text-slate-300 dark:text-slate-600">
              · {grouped[group].length}
            </span>
          </div>

          {grouped[group].map((item) => (
            <ShipmentRow
              key={item.id}
              item={item}
              nowMs={nowMs}
              onCancelAction={setCancelTarget}
            />
          ))}
        </section>
      ))}

      <CancelShipmentModal
        item={cancelTarget}
        isSubmitting={isCancelling}
        onCloseAction={() => !isCancelling && setCancelTarget(null)}
        onConfirmAction={handleCancelConfirm}
      />
    </>
  );
}
