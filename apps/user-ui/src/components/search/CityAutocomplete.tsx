"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, MapPin, X } from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { loadPlacesLibrary } from "@/lib/googlePlaces";

/**
 * Données structurées extraites de Google Places
 */
export type PlaceDetails = {
  formattedAddress: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
  streetLine1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  countryCode: string | null;
};

/**
 * Extrait les composants structurés d'un objet Place Google
 */
function extractPlaceDetails(place: google.maps.places.Place): PlaceDetails {
  const components = place.addressComponents ?? [];

  const get = (type: string): string | null => {
    const comp = components.find((c) => c.types.includes(type));
    return comp?.longText ?? null;
  };

  const getShort = (type: string): string | null => {
    const comp = components.find((c) => c.types.includes(type));
    return comp?.shortText ?? null;
  };

  const streetNumber = get("street_number");
  const route = get("route");
  let streetLine1: string | null = null;
  if (streetNumber && route) {
    streetLine1 = `${streetNumber} ${route}`;
  } else if (route) {
    streetLine1 = route;
  }

  return {
    formattedAddress: place.formattedAddress ?? "",
    placeId: place.id ?? "",
    lat: place.location?.lat() ?? null,
    lng: place.location?.lng() ?? null,
    streetLine1,
    city: get("locality") ?? get("administrative_area_level_2"),
    region: get("administrative_area_level_1"),
    postalCode: get("postal_code"),
    country: get("country"),
    countryCode: getShort("country"),
  };
}

type Props = {
  /** Valeur courante du champ */
  value: string;
  /** Callback déclenché à chaque changement de valeur (frappe ou sélection) */
  action: (v: string) => void;
  /** Texte affiché quand le champ est vide */
  placeholder: string;
  /** Langue pour les suggestions Google Places */
  language?: "fr" | "en";
  /** Biais régional optionnel (ex. "fr") */
  regionBias?: string;
  /** Callback au moment de la sélection d'une suggestion (texte uniquement) */
  onSelect?: (v: string) => void;
  /** Callback avec les détails structurés de Google Places */
  onPlaceSelect?: (details: PlaceDetails) => void;
  /**
   * Callback au clear (bouton × cliqué).
   * Si fourni, le bouton × appelle uniquement `onClear` (le parent gère).
   * Si omis, le bouton × vide la valeur via `action("")`.
   */
  onClear?: () => void;
  /** Si true, affiche le bouton × quand value est non-vide. Par défaut: true */
  showClearButton?: boolean;
  /** Si true, masque l'icône MapPin interne (utile quand le parent gère l'icône) */
  hideIcon?: boolean;
  /** Focus automatique au montage */
  autoFocus?: boolean;
  /** Classes CSS additionnelles pour l'input */
  inputClassName?: string;
  /** Si true, le dropdown est inline (dans le flux) au lieu d'être absolute */
  dropdownInline?: boolean;
  /** aria-label pour l'input (par défaut: placeholder) */
  ariaLabel?: string;
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
                                         }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<google.maps.places.PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Track si l'utilisateur a sélectionné une suggestion (empêche réouverture)
  const hasSelectedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const outsideClickEnabled = open && !dropdownInline;
  useOnClickOutside(wrapRef, () => setOpen(false), outsideClickEnabled);

  const canQuery = useMemo(() => value.trim().length >= 2, [value]);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // ── Autocomplete fetch effect ──
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
          setOpen(top.length > 0);
          setHighlightedIndex(-1);
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
  }, [value, canQuery, language, regionBias]);

  // ── Select a suggestion ──
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
        } catch {
          onPlaceSelect({
            formattedAddress: label,
            placeId: p.placeId ?? "",
            lat: null,
            lng: null,
            streetLine1: null,
            city: null,
            region: null,
            postalCode: null,
            country: null,
            countryCode: null,
          });
        }
      }

      sessionTokenRef.current = null;
    },
    [action, onSelect, onPlaceSelect]
  );

  // ── Clear the field ──
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Reset interne
      setItems([]);
      setOpen(false);
      setHighlightedIndex(-1);
      hasSelectedRef.current = false;
      sessionTokenRef.current = null;

      if (onClear) {
        // Le parent gère le reset complet (ex: reset from + fromPlace)
        onClear();
      } else {
        // Comportement par défaut: on vide juste la valeur texte
        action("");
      }

      // Refocus pour que l'utilisateur puisse retaper immédiatement
      inputRef.current?.focus();
    },
    [action, onClear]
  );

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || items.length === 0) {
        if (e.key === "Escape") {
          inputRef.current?.blur();
        }
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

  const shouldShowDropdown = open && items.length > 0;

  const dropdown = shouldShowDropdown && (
    <div
      role="listbox"
      className={[
        dropdownInline
          ? "relative z-[400] mt-3 w-full"
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
              isHighlighted
                ? "bg-slate-50 dark:bg-slate-900"
                : "hover:bg-slate-50 dark:hover:bg-slate-900",
              idx === 0 ? "rounded-t-2xl" : "",
              idx === items.length - 1 ? "rounded-b-2xl" : "",
            ].join(" ")}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {title}
              </div>
              {subtitle && (
                <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {subtitle}
                </div>
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
          <MapPin
            className="shrink-0 text-slate-400 dark:text-slate-500"
            size={18}
            aria-hidden
          />
        )}

        <input
          ref={inputRef}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            hasSelectedRef.current = false;
            action(e.target.value);
          }}
          onFocus={() => {
            if (canQuery && items.length > 0 && !hasSelectedRef.current) {
              setOpen(true);
            }
          }}
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
          <Loader2
            className="shrink-0 animate-spin text-slate-400 dark:text-slate-500"
            size={16}
            aria-hidden
          />
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
