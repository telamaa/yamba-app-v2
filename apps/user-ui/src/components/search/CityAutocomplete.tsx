"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, MapPin } from "lucide-react";
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
  value: string;
  action: (v: string) => void;
  placeholder: string;
  language?: "fr" | "en";
  regionBias?: string;
  onSelect?: (v: string) => void;
  onPlaceSelect?: (details: PlaceDetails) => void;
  autoFocus?: boolean;
  inputClassName?: string;
  dropdownInline?: boolean;
};

export default function CityAutocomplete({
                                           value,
                                           action,
                                           placeholder,
                                           language = "fr",
                                           regionBias,
                                           onSelect,
                                           onPlaceSelect,
                                           autoFocus = false,
                                           inputClassName = "",
                                           dropdownInline = false,
                                         }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<google.maps.places.PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  // Track si l'utilisateur a sélectionné une suggestion (empêche réouverture)
  const hasSelectedRef = useRef(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const outsideClickEnabled = open && !dropdownInline;
  useOnClickOutside(wrapRef, () => setOpen(false), outsideClickEnabled);

  const canQuery = useMemo(() => value.trim().length >= 2, [value]);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    let alive = true;

    if (!canQuery) {
      setItems([]);
      setLoading(false);
      setOpen(false);
      hasSelectedRef.current = false;
      return () => {
        alive = false;
      };
    }

    // Ne pas relancer de recherche si on vient de sélectionner
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

  const select = async (p: google.maps.places.PlacePrediction) => {
    const label = p.text?.text ?? "";

    // Marquer comme sélectionné AVANT de mettre à jour la valeur
    hasSelectedRef.current = true;

    action(label);
    onSelect?.(label);
    setOpen(false);
    setItems([]);

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
  };

  // Unifié : toujours vérifier `open`
  const shouldShowDropdown = open && items.length > 0;

  const dropdown = shouldShowDropdown && (
    <div
      className={[
        dropdownInline
          ? "relative z-[400] mt-3 w-full"
          : "absolute left-0 right-0 top-full z-[400] mt-3",
        "max-h-72 overflow-auto rounded-2xl bg-white shadow-xl",
        "dark:bg-slate-950",
      ].join(" ")}
    >
      {items.map((p, idx) => {
        const title = p.mainText?.text ?? p.text?.text ?? "";
        const subtitle = p.secondaryText?.text ?? "";

        return (
          <button
            key={p.placeId ?? `${title}-${idx}`}
            type="button"
            onClick={() => select(p)}
            className={[
              "flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors",
              "hover:bg-slate-50 dark:hover:bg-slate-900",
              // Arrondir le premier et dernier item
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

  return (
    <div ref={wrapRef} className="relative z-[20]">
      <div className="flex items-center gap-3">
        <MapPin className="text-slate-400 dark:text-slate-500" size={18} />
        <input
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
          placeholder={placeholder}
          className={[
            "w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500",
            "text-base md:text-sm",
            inputClassName,
          ].join(" ")}
        />
        {loading && <Loader2 className="animate-spin text-slate-400 dark:text-slate-500" size={16} />}
      </div>

      {dropdown}
    </div>
  );
}
