"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Bell, ArrowDownUp, ArrowLeftRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CityAutocomplete, {
  type PlaceDetails,
} from "@/components/search/CityAutocomplete";
import { useCreateSavedRoute } from "@/hooks/useSavedRouteMutations";
import { applyDateRangePreset } from "@/lib/saved-route.helpers";
import type {
  CreateSavedRoutePayload,
  DateRangePreset,
} from "@/lib/saved-route.types";

type Props = {
  isOpen: boolean;
  closeAction: () => void;
  initialOriginCity?: string;
  initialDestinationCity?: string;
  initialOriginPlace?: PlaceDetails | null;
  initialDestinationPlace?: PlaceDetails | null;
};

export default function CreateSavedRouteModal({
                                                isOpen,
                                                closeAction,
                                                initialOriginCity,
                                                initialDestinationCity,
                                                initialOriginPlace,
                                                initialDestinationPlace,
                                              }: Props) {
  const t = useTranslations("savedRoutes.create");

  const [originInputValue, setOriginInputValue] = useState(initialOriginCity ?? "");
  const [destinationInputValue, setDestinationInputValue] = useState(initialDestinationCity ?? "");
  const [originPlace, setOriginPlace] = useState<PlaceDetails | null>(initialOriginPlace ?? null);
  const [destinationPlace, setDestinationPlace] = useState<PlaceDetails | null>(initialDestinationPlace ?? null);

  const [preset, setPreset] = useState<DateRangePreset>("3months");
  const [customEarliest, setCustomEarliest] = useState<string>("");
  const [customLatest, setCustomLatest] = useState<string>("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [includeNearby, setIncludeNearby] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const { mutate: createSavedRoute, isPending } = useCreateSavedRoute();

  useEffect(() => {
    if (!isOpen) {
      setOriginInputValue(initialOriginCity ?? "");
      setDestinationInputValue(initialDestinationCity ?? "");
      setOriginPlace(initialOriginPlace ?? null);
      setDestinationPlace(initialDestinationPlace ?? null);
      setPreset("3months");
      setCustomEarliest("");
      setCustomLatest("");
      setEmailEnabled(true);
      setIncludeNearby(true);
      setFormError(null);
    }
  }, [isOpen, initialOriginCity, initialDestinationCity, initialOriginPlace, initialDestinationPlace]);

  // ✨ PAS de body scroll lock — préserve les éléments sticky de la page parent

  if (!isOpen) return null;

  const isPlaceComplete = (
    p: PlaceDetails | null
  ): p is PlaceDetails & {
    city: string;
    country: string;
    countryCode: string;
  } => {
    return !!p && !!p.city && !!p.country && !!p.countryCode;
  };

  const canSubmit = (() => {
    if (!isPlaceComplete(originPlace)) return false;
    if (!isPlaceComplete(destinationPlace)) return false;
    if (
      originPlace.city.toLowerCase().trim() ===
      destinationPlace.city.toLowerCase().trim() &&
      originPlace.countryCode === destinationPlace.countryCode
    ) {
      return false;
    }
    if (preset === "custom") {
      if (!customEarliest && !customLatest) return false;
      if (customEarliest && customLatest && customEarliest > customLatest) return false;
    }
    return true;
  })();

  const handleSwap = () => {
    const tmpInput = originInputValue;
    const tmpPlace = originPlace;
    setOriginInputValue(destinationInputValue);
    setOriginPlace(destinationPlace);
    setDestinationInputValue(tmpInput);
    setDestinationPlace(tmpPlace);
  };

  const handleSubmit = () => {
    if (!isPlaceComplete(originPlace) || !isPlaceComplete(destinationPlace)) {
      setFormError(t("errors.missingCities"));
      return;
    }

    if (
      originPlace.city.toLowerCase().trim() ===
      destinationPlace.city.toLowerCase().trim() &&
      originPlace.countryCode === destinationPlace.countryCode
    ) {
      setFormError(t("errors.sameOriginDestination"));
      return;
    }

    setFormError(null);

    let earliestDate: string | null = null;
    let latestDate: string | null = null;
    if (preset === "custom") {
      earliestDate = customEarliest ? new Date(customEarliest).toISOString() : null;
      latestDate = customLatest ? new Date(customLatest).toISOString() : null;
    } else if (preset !== "unlimited") {
      const range = applyDateRangePreset(preset);
      earliestDate = range.earliestDate;
      latestDate = range.latestDate;
    }

    const payload: CreateSavedRoutePayload = {
      originCity: originPlace.city,
      originCityCode: originPlace.cityCode ?? null,
      originCountry: originPlace.country,
      originCountryCode: originPlace.countryCode,
      originRegion: originPlace.region ?? null,
      originRegionCode: originPlace.regionCode ?? null,
      originPlaceId: originPlace.placeId ?? null,
      originLat: originPlace.lat ?? null,
      originLng: originPlace.lng ?? null,
      destinationCity: destinationPlace.city,
      destinationCityCode: destinationPlace.cityCode ?? null,
      destinationCountry: destinationPlace.country,
      destinationCountryCode: destinationPlace.countryCode,
      destinationRegion: destinationPlace.region ?? null,
      destinationRegionCode: destinationPlace.regionCode ?? null,
      destinationPlaceId: destinationPlace.placeId ?? null,
      destinationLat: destinationPlace.lat ?? null,
      destinationLng: destinationPlace.lng ?? null,
      earliestDate,
      latestDate,
      emailEnabled,
      includeNearby,
    };

    createSavedRoute(payload, {
      onSuccess: () => {
        toast.success(t("successToast"));
        closeAction();
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : t("errors.unknown");
        setFormError(message);
      },
    });
  };

  const needsOriginSelection = !!initialOriginCity && !originPlace;
  const needsDestinationSelection = !!initialDestinationCity && !destinationPlace;
  const showSelectionHint = needsOriginSelection || needsDestinationSelection;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 backdrop-blur-md sm:items-center sm:p-4"
      onClick={closeAction}
    >
      <div
        className="relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800 sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* ─── Drag handle (mobile) ─── */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* ─── Header ─── */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-50 text-[#FF9900] dark:bg-orange-500/15">
              <Bell size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {t("title")}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAction}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={t("close")}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Body scrollable ─── */}
        <div
          className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6
                     [&::-webkit-scrollbar]:w-1.5
                     [&::-webkit-scrollbar-track]:bg-transparent
                     [&::-webkit-scrollbar-thumb]:rounded-full
                     [&::-webkit-scrollbar-thumb]:bg-slate-300
                     dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
        >

          {/* ═══ TRAJET (horizontal sur desktop, vertical sur mobile) ═══ */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("routeLabel")}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:gap-3">
              {/* DÉPART */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Départ
                </label>
                <div className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 transition-colors focus-within:border-[#FF9900] dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-[#FF9900]">
                  <CityAutocomplete
                    value={originInputValue}
                    action={setOriginInputValue}
                    onPlaceSelect={setOriginPlace}
                    onClear={() => {
                      setOriginInputValue("");
                      setOriginPlace(null);
                    }}
                    placeholder={t("originPlaceholder")}
                    dropdownInline
                    autoSelectIfPrefilled={
                      initialOriginCity && !initialOriginPlace ? initialOriginCity : null
                    }
                    inputClassName="text-sm"
                  />
                </div>
              </div>

              {/* SWAP BUTTON */}
              <div className="flex justify-center sm:pb-3">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-[#FF9900] hover:text-[#FF9900] active:scale-90 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-[#FF9900]"
                  aria-label="Inverser départ et arrivée"
                >
                  <ArrowDownUp size={14} strokeWidth={2.5} className="sm:hidden" />
                  <ArrowLeftRight size={14} strokeWidth={2.5} className="hidden sm:block" />
                </button>
              </div>

              {/* ARRIVÉE */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Arrivée
                </label>
                <div className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 transition-colors focus-within:border-[#FF9900] dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-[#FF9900]">
                  <CityAutocomplete
                    value={destinationInputValue}
                    action={setDestinationInputValue}
                    onPlaceSelect={setDestinationPlace}
                    onClear={() => {
                      setDestinationInputValue("");
                      setDestinationPlace(null);
                    }}
                    placeholder={t("destinationPlaceholder")}
                    dropdownInline
                    autoSelectIfPrefilled={
                      initialDestinationCity && !initialDestinationPlace ? initialDestinationCity : null
                    }
                    inputClassName="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Hint visible uniquement si auto-select a échoué */}
            {showSelectionHint && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-300">
                  <strong>Confirme ta ville :</strong> clique dans le champ ci-dessus, puis sélectionne la ville dans la liste qui s'ouvre.
                </p>
              </div>
            )}
          </div>

          {/* ═══ PÉRIODE ═══ */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("periodLabel")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PresetButton active={preset === "3months"} onClick={() => setPreset("3months")} label={t("presets.3months")} recommended />
              <PresetButton active={preset === "6months"} onClick={() => setPreset("6months")} label={t("presets.6months")} />
              <PresetButton active={preset === "unlimited"} onClick={() => setPreset("unlimited")} label={t("presets.unlimited")} />
              <PresetButton active={preset === "custom"} onClick={() => setPreset("custom")} label={t("presets.custom")} />
            </div>

            {preset === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t("earliestDate")}</label>
                  <input
                    type="date"
                    value={customEarliest}
                    onChange={(e) => setCustomEarliest(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#FF9900] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t("latestDate")}</label>
                  <input
                    type="date"
                    value={customLatest}
                    onChange={(e) => setCustomLatest(e.target.value)}
                    min={customEarliest || new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#FF9900] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ═══ NOTIFICATIONS ═══ */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("notificationsLabel")}
            </p>
            <div className="space-y-2">
              <ToggleRow checked={emailEnabled} onChange={setEmailEnabled} title={t("emailToggle.title")} description={t("emailToggle.description")} />
              <ToggleRow checked={includeNearby} onChange={setIncludeNearby} title={t("nearbyToggle.title")} description={t("nearbyToggle.description")} />
            </div>
          </div>

          {formError && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {formError}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={closeAction}
              disabled={isPending}
              className="rounded-full px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 sm:py-2.5"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#FF9900] px-6 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {!isPending && <Sparkles size={14} />}
              {t("submit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */

function PresetButton({ active, onClick, label, recommended }: {
  active: boolean;
  onClick: () => void;
  label: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border-2 px-3 py-3 text-xs font-semibold transition-all active:scale-95 ${
        active
          ? "border-[#FF9900] bg-orange-50 text-[#B45309] dark:bg-orange-500/10 dark:text-[#FFB84D]"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
      }`}
    >
      {label}
      {recommended && (
        <span className="absolute -right-1 -top-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300">
          ★
        </span>
      )}
    </button>
  );
}

function ToggleRow({ checked, onChange, title, description }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[#FF9900]" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "right-0.5" : "left-0.5"}`} />
      </button>
      <div className="flex-1">
        <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </label>
  );
}
