"use client";

import { Baby, Banknote, Check, Clock3, FileText, Medal, Package, ShieldCheck, Shirt, ShoppingBag, Smartphone, Sparkles, Star, Ticket, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { BILLING_FLOOR_KG } from "@/lib/pricing-example";
import { EMPTY_FACET_OPACITY, isEmptyFacet } from "@/lib/search-facets";
import {
  SEARCH_FAMILIES,
  type DepartureTimeBucket,
  type SearchFamily,
  type SortOption,
} from "./search-results.types";

type Props = {
  // ── Sort ──
  sort: SortOption;
  onSortChange: (value: SortOption) => void;

  // ── Trust & safety ──
  superTripperOnly: boolean;
  onSuperTripperChange: (value: boolean) => void;

  profileVerifiedOnly: boolean;
  onProfileVerifiedChange: (value: boolean) => void;

  instantBookingOnly: boolean;
  onInstantBookingChange: (value: boolean) => void;

  verifiedTicketOnly: boolean;
  onVerifiedTicketChange: (value: boolean) => void;

  superTripperCount: number;
  profileVerifiedCount: number;
  instantBookingCount: number;
  verifiedTicketCount: number;

  // ── Departure times ── (gardé dans l'API pour réactivation future)
  selectedDepartureBuckets?: DepartureTimeBucket[];
  onToggleDepartureBucket?: (bucket: DepartureTimeBucket) => void;

  // ── Familles (D14/D33) ──
  selectedFamilies: SearchFamily[];
  onToggleFamily: (value: SearchFamily) => void;
  familyCounts: Partial<Record<SearchFamily, number>>;

  // ── Poids du colis (D33 V2) — null = référence 2 kg ──
  weightKg: number | null;
  onWeightChange: (value: number | null) => void;

  // ── Actions ──
  onClear: () => void;

  // ── UI options ──
  hideHeader?: boolean;
  className?: string;
};

/** D14 — icônes Lucide des 8 familles (mêmes clés que l'API) */
const FAMILY_ICONS: Record<SearchFamily, React.ReactNode> = {
  DOCUMENTS_PAPERS: <FileText size={14} />,
  CLOTHES_TEXTILE: <Shirt size={14} />,
  FOOD_DRY_SEALED: <Package size={14} />,
  ELECTRONICS_DEVICES: <Smartphone size={14} />,
  COSMETICS_CARE: <Sparkles size={14} />,
  PARTS_TOOLS: <Wrench size={14} />,
  TOYS_CHILDCARE: <Baby size={14} />,
  MISC_ACCESSORIES: <ShoppingBag size={14} />,
};

function CustomRadio({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        checked
          ? "border-[#FF9900]"
          : "border-slate-300 dark:border-slate-600",
      ].join(" ")}
    >
      {checked && (
        <span className="h-2 w-2 rounded-full bg-[#FF9900]" />
      )}
    </span>
  );
}

// ── Custom checkbox ──
// Remplace <input type="checkbox"> natif pour garantir visibilité en dark mode
// et éviter les bugs d'association label-input.
// D100 6A — la case n'a plus d'état « désactivée » : son unique appelant ne
// désactive plus rien (une facette à zéro s'efface, elle ne s'éteint pas), et
// le `disabled` qu'on lui passait valait `false` en dur. Une apparence qu'on
// garde « au cas où » est du code mort qui se maintient — règle de D95/D98.
function CustomCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
        checked
          ? "border-[#FF9900] bg-[#FF9900]"
          : "border-slate-300 dark:border-slate-600",
      ].join(" ")}
    >
      {checked && <Check size={11} strokeWidth={3.5} className="text-white" />}
    </span>
  );
}

function RightMeta({
                     count,
                     icon,
                   }: {
  count?: number;
  icon: React.ReactNode;
}) {
  // D100 6A — son unique appelant (`visibleTrustOptions`) ne lui passe plus
  // que des compteurs > 0 : la variante « éteinte » n'était plus atteignable.
  return (
    <span className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
      {typeof count === "number" && (
        <span className="min-w-[18px] text-right text-[12px] font-semibold tabular-nums">
          {count}
        </span>
      )}
      <span>{icon}</span>
    </span>
  );
}

export default function SearchFiltersSidebar({
                                               sort,
                                               onSortChange,
                                               superTripperOnly,
                                               onSuperTripperChange,
                                               profileVerifiedOnly,
                                               onProfileVerifiedChange,
                                               instantBookingOnly,
                                               onInstantBookingChange,
                                               verifiedTicketOnly,
                                               onVerifiedTicketChange,
                                               superTripperCount,
                                               profileVerifiedCount,
                                               instantBookingCount,
                                               verifiedTicketCount,
                                               // selectedDepartureBuckets = [],   // ⚠️ Commenté — section désactivée
                                               // onToggleDepartureBucket,         // ⚠️ Commenté — section désactivée
                                               selectedFamilies,
                                               onToggleFamily,
                                               familyCounts,
                                               weightKg,
                                               onWeightChange,
                                               onClear,
                                               hideHeader = false,
                                               className = "",
                                             }: Props) {
  const t = useTranslations("search");


  // ── Sort options ──
  const sortOptions: Array<{
    value: SortOption;
    label: string;
    hint?: string;
    icon: React.ReactNode;
  }> = [
    // D100 1A/1B — le DÉFAUT du serveur depuis D80, enfin nommé. Il était
    // appliqué sans être affiché : « Départ le plus tôt » portait son résultat.
    {
      value: "relevance",
      label: t("filters.relevance"),
      hint: t("filters.relevanceHint"),
      icon: <Sparkles size={18} />,
    },
    {
      value: "earliest",
      label: t("filters.earliest"),
      icon: <Clock3 size={18} />,
    },
    {
      value: "lowestPrice",
      label: t("filters.lowestPrice"),
      hint: weightKg ? t("filters.lowestPriceHintWeight", { kg: weightKg }) : t("filters.lowestPriceHint"),
      icon: <Banknote size={18} />,
    },
    {
      value: "bestRated",
      label: t("filters.bestRated"),
      icon: <Star size={18} />,
    },
  ];

  // ── Trust options ──
  const trustOptions = [
    {
      checked: superTripperOnly,
      onChange: onSuperTripperChange,
      label: t("badges.superTripper"),
      icon: <Medal size={18} className="text-[#FF9900]" />,
      count: superTripperCount,
    },
    {
      checked: profileVerifiedOnly,
      onChange: onProfileVerifiedChange,
      label: t("badges.profileVerified"),
      icon: <ShieldCheck size={18} className="text-[#FF9900]" />,
      count: profileVerifiedCount,
    },
    // D20 v1 — « Réservation instantanée » n'existe plus : toute demande passe
    // par l'accord du Voyageur. Props conservées (API du composant), entrée retirée.
    {
      checked: verifiedTicketOnly,
      onChange: onVerifiedTicketChange,
      label: t("badges.verifiedTicket"),
      icon: <Ticket size={18} className="text-[#FF9900]" />,
      count: verifiedTicketCount,
    },
  ];

  // D100 6A — une seule source pour la section ET son titre. Le filtre
  // `count > 0` ne vivait qu'au point de rendu des options : le titre, lui,
  // ne le voyait pas, et survivait donc à son propre contenu.
  const visibleTrustOptions = trustOptions.filter((o) => o.count > 0);

  // ⚠️ DÉSACTIVÉ — Bloc "Horaires de départ" masqué pour le MVP.
  // ⚠️ La logique côté SearchResultsView est conservée pour réactivation rapide.
  // ⚠️ Pour réactiver:
  //   1. Décommenter les imports lucide en haut (Sun, Sunrise, Sunset, Moon)
  //   2. Décommenter les déstructurations `selectedDepartureBuckets` et `onToggleDepartureBucket`
  //   3. Décommenter le bloc <DepartureBucketsSection /> dans le rendu plus bas
  //
  // const departureBuckets: Array<{
  //   value: DepartureTimeBucket;
  //   label: string;
  //   range: string;
  //   icon: React.ReactNode;
  // }> = [
  //   { value: "morning",   label: t("departureTimes.morning"),   range: "06h–12h", icon: <Sunrise size={14} /> },
  //   { value: "afternoon", label: t("departureTimes.afternoon"), range: "12h–18h", icon: <Sun size={14} /> },
  //   { value: "evening",   label: t("departureTimes.evening"),   range: "18h–22h", icon: <Sunset size={14} /> },
  //   { value: "night",     label: t("departureTimes.night"),     range: "22h–06h", icon: <Moon size={14} /> },
  // ];

  // ── Detect if any filter is active (to show "Clear all") ──
  const hasActiveFilters =
    sort !== "earliest" ||
    superTripperOnly ||
    profileVerifiedOnly ||
    instantBookingOnly ||
    verifiedTicketOnly ||
    selectedFamilies.length > 0 ||
    weightKg !== null;
  // ⚠️ Réactiver pour "Horaires de départ" :
  // || selectedDepartureBuckets.length > 0;

  return (
    <aside
      className={[
        "h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900",
        className,
      ].join(" ")}
    >
      {/* min-h-[44px] : même hauteur que l'en-tête des cartes résultat → alignées */}
      {!hideHeader && (
        <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 dark:border-slate-800/60 dark:bg-slate-950/40">
          {/* D100 7A — le panneau contient le tri, la confiance, le poids et les
              familles : il s'intitulait « Trier par », c'est-à-dire par une de
              ses quatre parties. */}
          <h2 className="text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">
            {t("filters.title")}
          </h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="text-[12px] font-semibold text-[#FF9900] transition-colors hover:text-[#F08700] dark:text-[#FFB84D] dark:hover:text-[#FF9900]"
            >
              {t("filters.clearAll")}
            </button>
          )}
        </div>
      )}

      <div
        className="space-y-5 px-5 py-4"
        // ⚠️ role="group" pour accessibilité — annonce que tout ce bloc est un conteneur de filtres
        role="group"
        aria-label={t("filters.title")}
      >
        {/* ── Sort (custom radio buttons) ── */}
        <div
          className="space-y-2"
          role="radiogroup"
          aria-label={t("filters.sortBy")}
        >
          {sortOptions.map((opt) => {
            const isActive = sort === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onSortChange(opt.value)}
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "bg-[#FFF6E8] dark:bg-[#FF9900]/10"
                    : "hover:bg-slate-50 dark:hover:bg-slate-900/60",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]/40",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CustomRadio checked={isActive} />
                  <span
                    className={[
                      "min-w-0 text-[13px]",
                      isActive
                        ? "font-semibold text-slate-900 dark:text-white"
                        : "font-medium text-slate-700 dark:text-slate-300",
                    ].join(" ")}
                  >
                    {opt.label}
                    {opt.hint && (
                      <span className="block text-[11px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                        {opt.hint}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={
                    isActive
                      ? "text-[#FF9900]"
                      : "text-slate-400 dark:text-slate-500"
                  }
                >
                  {opt.icon}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Trust & safety (custom checkboxes) ──
             D100 6A — la section ENTIÈRE est conditionnée au même filtre que son
             contenu (`count > 0`). Le titre était rendu sans condition : orphelin
             à l'œil dès qu'aucune option n'avait de résultat, et section vide
             annoncée pour un lecteur d'écran. Un titre ne survit pas à sa section. */}
        {visibleTrustOptions.length > 0 && (
        <div
          className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/60"
          role="group"
          aria-label={t("filters.trustSafety")}
        >
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t("filters.trustSafety")}
          </h3>

          <div className="space-y-1">
            {visibleTrustOptions.map((option) => {
              // D100 6A — `const disabled = false` vivait ici, suivi de QUATRE
              // branches de style pour un état que rien ne pouvait atteindre.
              // Du code qui décrit un comportement qu'il n'a pas : la maladie
              // même de ce lot, en version silencieuse.
              return (
                <button
                  key={option.label}
                  type="button"
                  role="checkbox"
                  aria-checked={option.checked}
                  onClick={() => option.onChange(!option.checked)}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                    "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/60",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]/40",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CustomCheckbox checked={option.checked} />
                    <span className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-300">
                      {option.label}
                    </span>
                  </span>
                  <RightMeta count={option.count} icon={option.icon} />
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* ⚠️ ──────────────────────────────────────────────────────── */}
        {/* ⚠️ DÉSACTIVÉ — Section "Horaires de départ" cachée pour MVP */}
        {/* ⚠️ Pour réactiver : décommenter ce bloc + voir notes en haut */}
        {/* ⚠️ ──────────────────────────────────────────────────────── */}
        {/*
        {onToggleDepartureBucket && (
          <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/60">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("filters.departureTimes")}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {departureBuckets.map((bucket) => {
                const isActive = selectedDepartureBuckets.includes(bucket.value);
                return (
                  <button
                    key={bucket.value}
                    type="button"
                    onClick={() => onToggleDepartureBucket(bucket.value)}
                    className={[
                      "inline-flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors",
                      isActive
                        ? "border-[#FF9900]/50 bg-[#FFF6E8] dark:border-[#FF9900]/40 dark:bg-[#FF9900]/10"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:bg-slate-800",
                    ].join(" ")}
                  >
                    <span className={[
                      "inline-flex items-center gap-1.5 text-[12px] font-semibold",
                      isActive ? "text-[#B45309] dark:text-[#FFB84D]" : "text-slate-700 dark:text-slate-300",
                    ].join(" ")}>
                      {bucket.icon}
                      {bucket.label}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums dark:text-slate-500">
                      {bucket.range}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        */}

        {/* ── Votre colis (D33 V2) : le poids pilote prix, tri et capacité ── */}
        <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/60">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("filters.yourParcel")}
            </h3>
            <span className="text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
              {(weightKg ?? 2).toLocaleString("fr-FR")} kg
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={30}
            step={0.5}
            value={weightKg ?? 2}
            aria-label={t("filters.weight")}
            onChange={(e) => onWeightChange(Number(e.target.value))}
            className="h-11 w-full cursor-pointer touch-pan-x"
            style={{ accentColor: "#FF9900" }}
          />
          <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            {/* D99 3B — le curseur affichait 2 kg (`weightKg ?? 2`) alors que
                son état réel était `null` : rien n'était envoyé au serveur, et
                la carte retombait sur un exemple à 2 kg codé en dur. Les deux
                coïncidaient par hasard. Le poids par défaut est désormais
                VRAIMENT appliqué (`estimateKg`), et la phrase dit ce que
                l'état fait : estimer seulement, ou estimer ET filtrer. */}
            {weightKg
              ? t("filters.weightHintActive", { kg: weightKg })
              : t("filters.weightHint", { kg: weightKg ?? 2 })}
          </p>
          <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            {t("filters.lightParcel", { kg: BILLING_FLOOR_KG })}
          </p>
        </div>

        {/* ── Familles (D14/D33) : « Que voulez-vous envoyer ? » ── */}
        <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/60">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t("filters.families")}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {SEARCH_FAMILIES.map((family) => {
              const active = selectedFamilies.includes(family);
              const count = familyCounts[family];
              // D100 5A — une famille sans résultat s'EFFACE au lieu d'être
              // désactivée : à zéro, la facette reste le chemin de sortie du
              // filtre qu'on vient de poser. Trois traitements d'un même zéro
              // coexistaient dans le produit ; il n'en reste qu'un.
              const isEmpty = isEmptyFacet(count, active);
              return (
                <button
                  key={family}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleFamily(family)}
                  style={isEmpty ? { opacity: EMPTY_FACET_OPACITY } : undefined}
                  className={[
                    "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-[#FF9900]/40 bg-[#FFF6E8] text-[#B45309] dark:border-[#FF9900]/30 dark:bg-[#FF9900]/10 dark:text-[#FFB84D]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800",
                  ].join(" ")}
                >
                  {FAMILY_ICONS[family]}
                  {t(`families.${family}`)}
                  {typeof count === "number" && (
                    <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
