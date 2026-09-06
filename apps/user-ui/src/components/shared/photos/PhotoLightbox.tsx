"use client";

/**
 * PhotoLightbox.tsx — visionneuse plein écran partagée (A48)
 * ==========================================================
 * Une seule visionneuse pour toutes les photos de colis (déclarées,
 * pickup, litige), des deux côtés. Clavier (Échap, ← →), tactile
 * (balayage), compteur, fermeture au clic hors image. Extraite de
 * DealParcelPhotos (qui l'utilise désormais).
 */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";

export type ViewerPhoto = {
  id: string;
  url: string;
  label?: string;
};

type Props = {
  photos: ViewerPhoto[];
  index: number;
  onCloseAction: () => void;
  onIndexChangeAction: (index: number) => void;
};

export default function PhotoLightbox({ photos, index, onCloseAction, onIndexChangeAction }: Props) {
  const t = useTranslations("common");
  const photo = photos[index];
  const touchStartX = useRef<number | null>(null);

  const next = useCallback(
    () => onIndexChangeAction((index + 1) % photos.length),
    [index, photos.length, onIndexChangeAction]
  );
  const prev = useCallback(
    () => onIndexChangeAction((index - 1 + photos.length) % photos.length),
    [index, photos.length, onIndexChangeAction]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onCloseAction, next, prev]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onCloseAction}
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null || photos.length < 2) return;
        const delta = (e.changedTouches[0]?.clientX ?? start) - start;
        if (delta < -40) next();
        if (delta > 40) prev();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCloseAction();
        }}
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label={t("lightbox.close")}
      >
        <X size={20} />
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-4 sm:h-12 sm:w-12"
            aria-label={t("lightbox.previous")}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-4 sm:h-12 sm:w-12"
            aria-label={t("lightbox.next")}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div className="max-h-[90vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.label || ""}
          className="max-h-[84vh] max-w-[92vw] rounded-lg object-contain"
        />
        <div className="mt-3 flex items-center justify-center gap-3 text-[12px] font-medium text-white/80">
          {photo.label && <span>{photo.label}</span>}
          {photos.length > 1 && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 tabular-nums">
              {t("lightbox.counter", { current: index + 1, total: photos.length })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
