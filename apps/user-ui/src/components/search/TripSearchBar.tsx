"use client";

import React, { useCallback, useState } from "react";
import { ArrowLeftRight, MapPin, Search } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { usePersistedFormState } from "@/hooks/usePersistedFormState";
import { useScrollThreshold } from "@/hooks/useScrollThreshold";
import AppContainer from "@/components/layout/AppContainer";
import CityAutocomplete from "./CityAutocomplete";
import MobileSearchExperience from "./MobileSearchExperience";
import SmartDatePicker, { type DateValue } from "@/components/ui/SmartDatePicker";

type Mode = "expanded" | "compact" | "auto";

type Props = {
  /**
   * Mode d'affichage de la search bar :
   *  - "expanded" : version large avec labels (utilisé dans le hero au repos)
   *  - "compact" : version compacte sans labels (utilisé dans le header au scroll)
   *  - "auto" : ancien comportement basé sur le scroll (legacy, page search)
   *
   * Par défaut "expanded".
   */
  mode?: Mode;
  /**
   * [Mode "auto" uniquement] Si true, la barre s'ajuste au scroll
   * (sticky positionné + mode compact).
   */
  stickyOnScroll?: boolean;
  /**
   * [Mode "auto" uniquement] Active uniquement le mode compact au scroll
   * sans activer le sticky.
   */
  forceCompactOnScroll?: boolean;
  /**
   * [Mode "auto" uniquement] Désactive le mode compact même quand sticky
   * est activé.
   */
  disableCompact?: boolean;
};

type SearchDraft = {
  from: string;
  to: string;
  dateValue: DateValue | null;
};

type FocusedField = "from" | "to" | "date" | null;

const initialSearchDraft: SearchDraft = {
  from: "",
  to: "",
  dateValue: null,
};

const SEARCH_VERSION = 2;
const SCROLL_THRESHOLD = 120;
const HEADER_HEIGHT = 78;

const CITY_AUTOCOMPLETE_NORMAL_CLASSES =
  "[&_input]:h-6 [&_input]:text-[14px] [&_input]:leading-6";
const CITY_AUTOCOMPLETE_COMPACT_CLASSES =
  "[&_input]:h-5 [&_input]:text-[13px] [&_input]:leading-5";

export default function TripSearchBar({
                                        mode = "expanded",
                                        stickyOnScroll = false,
                                        forceCompactOnScroll = false,
                                        disableCompact = false,
                                      }: Props) {
  const t = useTranslations("common");
  const locale = useLocale();

  const [draft, setDraft] = usePersistedFormState<SearchDraft>(
    "trip-search",
    initialSearchDraft,
    { version: SEARCH_VERSION }
  );

  const [focused, setFocused] = useState<FocusedField>(null);
  const [swapRotation, setSwapRotation] = useState(0);
  const isScrolled = useScrollThreshold(SCROLL_THRESHOLD);

  // Détermine si on est en mode compact selon le mode choisi
  const isCompact =
    mode === "compact"
      ? true
      : mode === "expanded"
        ? false
        : // mode "auto" : ancien comportement basé sur le scroll
        !disableCompact &&
        (stickyOnScroll || forceCompactOnScroll) &&
        isScrolled;

  // Le sticky n'est actif qu'en mode "auto"
  const useSticky = mode === "auto" && stickyOnScroll;

  // ── Handlers ──

  const setFrom = useCallback(
    (v: string) => setDraft((d) => ({ ...d, from: v })),
    [setDraft]
  );
  const setTo = useCallback(
    (v: string) => setDraft((d) => ({ ...d, to: v })),
    [setDraft]
  );
  const setDateValue = useCallback(
    (v: DateValue | null) => setDraft((d) => ({ ...d, dateValue: v })),
    [setDraft]
  );

  const clearFrom = useCallback(
    () => setDraft((d) => ({ ...d, from: "" })),
    [setDraft]
  );
  const clearTo = useCallback(
    () => setDraft((d) => ({ ...d, to: "" })),
    [setDraft]
  );

  const handleSwap = useCallback(() => {
    setSwapRotation((r) => r + 180);
    setDraft((d) => ({ ...d, from: d.to, to: d.from }));
  }, [setDraft]);

  const onSearch = useCallback(() => {
    console.log({
      from: draft.from,
      to: draft.to,
      dateValue: draft.dateValue,
    });
  }, [draft]);

  const cityAutocompleteWrapperClasses = isCompact
    ? CITY_AUTOCOMPLETE_COMPACT_CLASSES
    : CITY_AUTOCOMPLETE_NORMAL_CLASSES;

  return (
    <>
      {/* ── Mobile version ── */}
      <AppContainer className="md:hidden">
        <MobileSearchExperience
          mode="card"
          from={draft.from}
          to={draft.to}
          dateValue={draft.dateValue}
          onFromChange={setFrom}
          onToChange={setTo}
          onDateValueChange={setDateValue}
          onSearch={onSearch}
        />
      </AppContainer>

      {/* ── Desktop version ── */}
      <div
        className={[
          "hidden md:block",
          useSticky ? "sticky z-[90]" : "",
          useSticky && isScrolled
            ? "border-b border-slate-200/60 bg-white/95 py-3 shadow-sm backdrop-blur-xl backdrop-saturate-150 dark:border-slate-800/60 dark:bg-slate-950/95"
            : "",
          "transition-all duration-200",
        ].join(" ")}
        style={useSticky ? { top: HEADER_HEIGHT } : undefined}
      >
        <AppContainer className={isCompact ? "py-1" : "py-0"}>
          <div
            className={[
              "relative overflow-visible rounded-2xl",
              "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
              isCompact ? "shadow-sm" : "shadow-sm",
              "transition-all duration-300 ease-out",
            ].join(" ")}
          >
            <div className="relative grid items-stretch overflow-visible grid-cols-[1fr_36px_1fr_1fr_auto]">
              {/* ── Champ From ── */}
              <FieldWrapper
                isFocused={focused === "from"}
                position="first"
                onFocusCapture={() => setFocused("from")}
                onBlurCapture={() => setFocused(null)}
                isCompact={isCompact}
              >
                {!isCompact && (
                  <FieldLabel
                    active={focused === "from"}
                    icon={<MapPin size={12} strokeWidth={2.5} />}
                    label={t("fields.from")}
                  />
                )}
                <div
                  className={[
                    isCompact ? "" : "mt-1",
                    cityAutocompleteWrapperClasses,
                  ].join(" ")}
                >
                  <CityAutocomplete
                    value={draft.from}
                    action={setFrom}
                    onClear={clearFrom}
                    hideIcon
                    placeholder={t("placeholders.cityFrom")}
                    language={locale === "fr" ? "fr" : "en"}
                  />
                </div>
              </FieldWrapper>

              {/* ── Bouton Swap ── */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleSwap}
                  aria-label={t("actions.swap")}
                  className={[
                    "inline-flex items-center justify-center rounded-full",
                    "border border-slate-200 bg-white text-slate-500",
                    "hover:border-[#FF9900] hover:text-[#FF9900]",
                    "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400",
                    "dark:hover:border-[#FF9900] dark:hover:text-[#FFB84D]",
                    "transition-all duration-300 ease-out",
                    isCompact ? "h-7 w-7" : "h-8 w-8",
                  ].join(" ")}
                  style={{ transform: `rotate(${swapRotation}deg)` }}
                >
                  <ArrowLeftRight size={isCompact ? 12 : 14} strokeWidth={2} />
                </button>
              </div>

              {/* ── Champ To ── */}
              <FieldWrapper
                isFocused={focused === "to"}
                position="middle"
                onFocusCapture={() => setFocused("to")}
                onBlurCapture={() => setFocused(null)}
                showSeparator={focused !== "to" && focused !== "from"}
                isCompact={isCompact}
              >
                {!isCompact && (
                  <FieldLabel
                    active={focused === "to"}
                    icon={<MapPin size={12} strokeWidth={2.5} />}
                    label={t("fields.to")}
                  />
                )}
                <div
                  className={[
                    isCompact ? "" : "mt-1",
                    cityAutocompleteWrapperClasses,
                  ].join(" ")}
                >
                  <CityAutocomplete
                    value={draft.to}
                    action={setTo}
                    onClear={clearTo}
                    hideIcon
                    placeholder={t("placeholders.cityTo")}
                    language={locale === "fr" ? "fr" : "en"}
                  />
                </div>
              </FieldWrapper>

              {/* ── Champ Date (SmartDatePicker) ── */}
              <FieldWrapper
                isFocused={focused === "date"}
                position="middle"
                onFocusCapture={() => setFocused("date")}
                onBlurCapture={() => setFocused(null)}
                showSeparator={focused !== "date" && focused !== "to"}
                isCompact={isCompact}
              >
                <SmartDatePicker
                  value={draft.dateValue}
                  onChangeAction={setDateValue}
                  triggerVariant="enriched"
                  showLabel={!isCompact}
                />
              </FieldWrapper>

              {/* ── Bouton Rechercher ── */}
              <div
                className={[
                  "flex items-center transition-all duration-300 ease-out",
                  isCompact ? "pr-2" : "pr-3",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={onSearch}
                  aria-label={t("actions.search")}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-xl",
                    "bg-[#FF9900] text-slate-950 font-semibold",
                    "hover:bg-[#F08700] active:bg-[#E07A00]",
                    "transition-all duration-300 ease-out",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
                    isCompact ? "h-8 px-3 text-[12px]" : "h-11 px-4 text-[13px]",
                  ].join(" ")}
                >
                  <Search size={isCompact ? 13 : 16} strokeWidth={2.5} />
                  <span className="hidden lg:inline">{t("actions.search")}</span>
                </button>
              </div>
            </div>
          </div>
        </AppContainer>
      </div>
    </>
  );
}

// ── Sub-components ──

function FieldWrapper({
                        children,
                        isFocused,
                        position,
                        onFocusCapture,
                        onBlurCapture,
                        showSeparator = false,
                        isCompact = false,
                      }: {
  children: React.ReactNode;
  isFocused: boolean;
  position: "first" | "middle" | "last";
  onFocusCapture: () => void;
  onBlurCapture: () => void;
  showSeparator?: boolean;
  isCompact?: boolean;
}) {
  return (
    <div
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      className={[
        "relative transition-all duration-300 ease-out",
        isCompact ? "flex items-center px-3 py-1.5" : "px-4 py-3",
        isFocused
          ? "bg-[#FF9900]/[0.04] dark:bg-[#FF9900]/[0.05]"
          : "hover:bg-slate-50/60 dark:hover:bg-slate-900/40",
        position === "first" ? "rounded-l-2xl" : "",
      ].join(" ")}
    >
      {showSeparator && (
        <div
          aria-hidden
          className="absolute left-0 top-1/2 h-1/2 w-px -translate-y-1/2 bg-slate-200/60 dark:bg-white/[0.06]"
        />
      )}

      {isFocused && (
        <div
          aria-hidden
          className={[
            "pointer-events-none absolute inset-0 ring-1 ring-inset ring-[#FF9900]/30",
            position === "first" ? "rounded-l-2xl" : "",
          ].join(" ")}
        />
      )}

      {isCompact ? (
        <div className="relative w-full">{children}</div>
      ) : (
        <div className="relative">{children}</div>
      )}
    </div>
  );
}

function FieldLabel({
                      active,
                      label,
                      icon,
                    }: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-1.5 text-xs font-semibold transition-colors",
        active
          ? "text-[#B45309] dark:text-[#FFB84D]"
          : "text-slate-500 dark:text-slate-400",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
