"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, MapPin, X } from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { loadPlacesLibrary } from "@/lib/googlePlaces";

export type PlaceDetails = {
  formattedAddress: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
  streetLine1: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  cityCode: string | null;
  regionCode: string | null;
  countryCode: string | null;
  postalCode: string | null;
};

function extractPlaceDetails(place: google.maps.places.Place): PlaceDetails {
  const components = place.addressComponents ?? [];
  const getLong = (type: string): string | null => {
    const comp = components.find((c) => c.types.includes(type));
    return comp?.longText ?? null;
  };
  const getShort = (type: string): string | null => {
    const comp = components.find((c) => c.types.includes(type));
    return comp?.shortText ?? null;
  };

  const streetNumber = getLong("street_number");
  const route = getLong("route");
  let streetLine1: string | null = null;
  if (streetNumber && route) streetLine1 = `${streetNumber} ${route}`;
  else if (route) streetLine1 = route;

  const countryLong = getLong("country");
  const countryCode = getShort("country");
  const regionLong = getLong("administrative_area_level_1");
  const regionShortRaw = getShort("administrative_area_level_1");
  let regionCode: string | null = null;
  if (regionShortRaw && countryCode) {
    regionCode = regionShortRaw.includes("-")
      ? regionShortRaw.toUpperCase()
      : `${countryCode}-${regionShortRaw}`.toUpperCase();
  }

  const cityLong = getLong("locality") ?? getLong("administrative_area_level_2");

  return {
    formattedAddress: place.formattedAddress ?? "",
    placeId: place.id ?? "",
    lat: place.location?.lat() ?? null,
    lng: place.location?.lng() ?? null,
    streetLine1,
    city: cityLong,
    region: regionLong,
    country: countryLong,
    cityCode: null,
    regionCode,
    countryCode,
    postalCode: getLong("postal_code"),
  };
}

type Props = {
  value: string;
  action: (v: string) => void;
  placeholder: string;
  language?: "fr" | "en";
  regionBias?: string;
  onSelect?: (v: string) => void;
  onPlaceSelect?: (details: PlaceDetails) => void;
  onClear?: () => void;
  showClearButton?: boolean;
  hideIcon?: boolean;
  autoFocus?: boolean;
  inputClassName?: string;
  dropdownInline?: boolean;
  ariaLabel?: string;
  /**
   * Si défini, le composant fait un fetch silencieux au mount et auto-sélectionne
   * la première suggestion qui matche exactement (case-insensitive).
   * Si pas de match exact, la dropdown s'ouvre normalement pour laisser choisir.
   */
  autoSelectIfPrefilled?: string | null;
};

export default function CityAutocomplete({
                                           value,
                                           action,
                                           placeholder,
                                           language = "fr",
                                           regionBias,
                                           onSelect,
                                           onPlaceSelect,
                                           onClear,
                                           showClearButton = true,
                                           hideIcon = false,
                                           autoFocus = false,
                                           inputClassName = "",
                                           dropdownInline = false,
                                           ariaLabel,
                                           autoSelectIfPrefilled = null,
                                         }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<google.maps.places.PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const hasSelectedRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const hasAutoSelectedRef = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const outsideClickEnabled = open && !dropdownInline;
  useOnClickOutside(wrapRef, () => setOpen(false), outsideClickEnabled);

  const canQuery = useMemo(() => value.trim().length >= 2, [value]);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const select = useCallback(
    async (p: google.maps.places.PlacePrediction) => {
      const label = p.text?.text ?? "";
      hasSelectedRef.current = true;

      action(label);
      onSelect?.(label);
      setOpen(false);
      setItems([]);
      setHighlightedIndex(-1);

      if (onPlaceSelect) {
        try {
          const place = p.toPlace();
          await place.fetchFields({
            fields: ["formattedAddress", "location", "addressComponents"],
          });
          const details = extractPlaceDetails(place);
          onPlaceSelect(details);
        } catch (err) {
          console.error("[CityAutocomplete] fetchFields failed:", err);
          onPlaceSelect({
            formattedAddress: label,
            placeId: p.placeId ?? "",
            lat: null,
            lng: null,
            streetLine1: null,
            city: null,
            region: null,
            country: null,
            cityCode: null,
            regionCode: null,
            countryCode: null,
            postalCode: null,
          });
        }
      }

      sessionTokenRef.current = null;
    },
    [action, onSelect, onPlaceSelect]
  );

  useEffect(() => {
    let alive = true;

    if (!canQuery) {
      setItems([]);
      setLoading(false);
      setOpen(false);
      setHighlightedIndex(-1);
      hasSelectedRef.current = false;
      return () => {
        alive = false;
      };
    }

    if (hasSelectedRef.current) return;

    const timer = setTimeout(() => {
      (async () => {
        try {
          setLoading(true);
          const places = await loadPlacesLibrary({
            language,
            ...(regionBias ? { region: regionBias } : {}),
          });
          const { AutocompleteSuggestion, AutocompleteSessionToken } = places;

          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new AutocompleteSessionToken();
          }

          const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            language,
            ...(regionBias ? { region: regionBias } : {}),
            sessionToken: sessionTokenRef.current,
          });

          const preds = (suggestions ?? [])
            .map((s) => s.placePrediction)
            .filter(Boolean) as google.maps.places.PlacePrediction[];

          if (!alive) return;

          const top = preds.slice(0, 8);
          setItems(top);
          setHighlightedIndex(-1);

          // ✨ AUTO-SELECT au mount si match exact avec valeur préremplie
          if (
            autoSelectIfPrefilled &&
            !hasAutoSelectedRef.current &&
            !hasInteractedRef.current &&
            top.length > 0
          ) {
            const target = autoSelectIfPrefilled.toLowerCase().trim();
            const exactMatch = top.find(
              (p) => (p.mainText?.text ?? "").toLowerCase().trim() === target
            );
            if (exactMatch) {
              hasAutoSelectedRef.current = true;
              select(exactMatch).catch(() => {});
              return; // Ne pas ouvrir la dropdown
            }
          }

          // Sinon : ouvre la dropdown si l'utilisateur a interagi ou pas d'autoSelect
          if (!autoSelectIfPrefilled || hasInteractedRef.current) {
            setOpen(top.length > 0);
          }
        } catch {
          if (!alive) return;
          setItems([]);
          setOpen(false);
        } finally {
          if (!alive) return;
          setLoading(false);
        }
      })().catch(() => {});
    }, 220);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [value, canQuery, language, regionBias, autoSelectIfPrefilled, select]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setItems([]);
      setOpen(false);
      setHighlightedIndex(-1);
      hasSelectedRef.current = false;
      hasInteractedRef.current = false;
      hasAutoSelectedRef.current = false;
      sessionTokenRef.current = null;

      if (onClear) onClear();
      else action("");
      inputRef.current?.focus();
    },
    [action, onClear]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || items.length === 0) {
        if (e.key === "Escape") inputRef.current?.blur();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i < items.length - 1 ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i > 0 ? i - 1 : items.length - 1));
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        select(items[highlightedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [open, items, highlightedIndex, select]
  );

  const handleFocus = useCallback(() => {
    hasInteractedRef.current = true;
    if (canQuery && items.length > 0 && !hasSelectedRef.current) {
      setOpen(true);
    }
  }, [canQuery, items.length]);

  const shouldShowDropdown = open && items.length > 0;

  const dropdown = shouldShowDropdown && (
    <div
      role="listbox"
      className={[
        dropdownInline
          ? "relative z-[400] mt-2 w-full"
          : "absolute left-0 right-0 top-full z-[400] mt-3",
        "max-h-72 overflow-auto rounded-2xl bg-white shadow-xl",
        "dark:bg-slate-950 dark:ring-1 dark:ring-slate-800",
      ].join(" ")}
    >
      {items.map((p, idx) => {
        const title = p.mainText?.text ?? p.text?.text ?? "";
        const subtitle = p.secondaryText?.text ?? "";
        const isHighlighted = idx === highlightedIndex;
        return (
          <button
            key={p.placeId ?? `${title}-${idx}`}
            type="button"
            role="option"
            aria-selected={isHighlighted}
            onClick={() => select(p)}
            onMouseEnter={() => setHighlightedIndex(idx)}
            className={[
              "flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors",
              isHighlighted ? "bg-slate-50 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900",
              idx === 0 ? "rounded-t-2xl" : "",
              idx === items.length - 1 ? "rounded-b-2xl" : "",
            ].join(" ")}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
              {subtitle && (
                <div className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>
              )}
            </div>
            <ChevronRight className="shrink-0 text-slate-300 dark:text-slate-600" size={18} />
          </button>
        );
      })}
    </div>
  );

  const showClear = showClearButton && value.length > 0;

  return (
    <div ref={wrapRef} className="relative z-[20]">
      <div className="flex items-center gap-3">
        {!hideIcon && (
          <MapPin className="shrink-0 text-slate-400 dark:text-slate-500" size={18} aria-hidden />
        )}
        <input
          ref={inputRef}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            hasSelectedRef.current = false;
            hasInteractedRef.current = true;
            action(e.target.value);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          aria-expanded={shouldShowDropdown}
          aria-autocomplete="list"
          role="combobox"
          className={[
            "w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500",
            "text-base md:text-sm",
            inputClassName,
          ].join(" ")}
        />
        {loading && (
          <Loader2 className="shrink-0 animate-spin text-slate-400 dark:text-slate-500" size={16} aria-hidden />
        )}
        {showClear && !loading && (
          <button
            type="button"
            onClick={handleClear}
            onMouseDown={(e) => e.preventDefault()}
            aria-label="Effacer"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}
