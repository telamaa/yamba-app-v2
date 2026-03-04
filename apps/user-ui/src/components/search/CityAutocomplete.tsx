"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2, ChevronRight } from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { loadPlacesLibrary } from "@/lib/googlePlaces";

type Props = {
  value: string;
  action: (v: string) => void; // Next-friendly
  placeholder: string;
  language?: "fr" | "en";
  /**
   * Optionnel : biais (pas restriction) au format ISO 3166-1 alpha-2
   * ex: "FR", "US", "GB"
   * Si absent => résultats monde entier (recommandé pour ton besoin actuel)
   */
  regionBias?: string;
};

export default function CityAutocomplete({
                                           value,
                                           action,
                                           placeholder,
                                           language = "fr",
                                           regionBias, // ✅ pas de valeur par défaut
                                         }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<google.maps.places.PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(wrapRef, () => setOpen(false), open);

  const canQuery = useMemo(() => value.trim().length >= 2, [value]);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    let alive = true;

    if (!canQuery) {
      setItems([]);
      setLoading(false);
      setOpen(false);
      return () => {
        alive = false;
      };
    }

    const timer = setTimeout(() => {
      (async () => {
        try {
          setLoading(true);

          // ✅ Important : ne pas forcer region ici, sinon biais France
          const places = await loadPlacesLibrary({
            language,
            ...(regionBias ? { region: regionBias } : {}),
          });

          const { AutocompleteSuggestion, AutocompleteSessionToken } = places;

          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new AutocompleteSessionToken();
          }

          // ✅ WORLDWIDE: pas de includedRegionCodes, pas de locationRestriction
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

  const select = (p: google.maps.places.PlacePrediction) => {
    const label = p.text?.text ?? "";
    action(label);
    setOpen(false);
    sessionTokenRef.current = null; // nouvelle session après sélection
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-3">
        <MapPin className="text-slate-400" size={18} />
        <input
          value={value}
          onChange={(e) => action(e.target.value)}
          onFocus={() => canQuery && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        {loading && <Loader2 className="animate-spin text-slate-400" size={16} />}
      </div>

      {open && items.length > 0 && (
        <div
          className={[
            "absolute left-0 right-0 top-12 z-[120]",
            "max-h-72 overflow-auto", // ✅ mieux que overflow-hidden
            "rounded-xl border border-slate-200 bg-white shadow-xl",
            "dark:border-slate-800 dark:bg-slate-950",
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
                  idx === 0 ? "bg-slate-50 dark:bg-slate-900/50" : "",
                  "hover:bg-slate-50 dark:hover:bg-slate-900",
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
                <ChevronRight className="shrink-0 text-slate-300" size={18} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
