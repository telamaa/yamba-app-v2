/**
 * DealParcelPhotos.tsx
 * ====================
 * Grid de photos déclarées par l'expéditeur, avec lightbox simple
 * (modal full-screen) au clic.
 *
 * Layout responsive :
 *  - Mobile : 2 cols (photos lisibles ~170px pour juger le contenu)
 *  - Tablet : 3 cols
 *  - Desktop : 4 cols
 * Photos en aspect-square pour cohérence visuelle.
 */

"use client";

import { ChevronLeft, ChevronRight, ImageIcon, Package, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { DealPhoto } from "./deal-request.types";

type Props = {
  photos: DealPhoto[];
  shipperFirstName: string;
};

export default function DealParcelPhotos({ photos, shipperFirstName }: Props) {
  const t = useTranslations("carrierDealRequest");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const open = useCallback((idx: number) => setActiveIndex(idx), []);
  const close = useCallback(() => setActiveIndex(null), []);
  const next = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length]
  );
  const prev = useCallback(
    () =>
      setActiveIndex((i) =>
        i === null ? null : (i - 1 + photos.length) % photos.length
      ),
    [photos.length]
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, close, next, prev]);

  if (photos.length === 0) return null;

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("photos.title", { shipperFirstName })}
        </div>
        <div className="hidden text-[10px] text-slate-400 dark:text-slate-500 md:block">
          {t("photos.subtitle")}
        </div>
      </div>

      {/* Grid responsive : 2 cols mobile, 3 tablet, 4 desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, idx) => (
          <PhotoThumbnail
            key={photo.id}
            photo={photo}
            onClickAction={() => open(idx)}
          />
        ))}
      </div>

      {activeIndex !== null && (
        <Lightbox
          photos={photos}
          index={activeIndex}
          onCloseAction={close}
          onNextAction={next}
          onPrevAction={prev}
        />
      )}
    </section>
  );
}

function PhotoThumbnail({
                          photo,
                          onClickAction,
                        }: {
  photo: DealPhoto;
  onClickAction: () => void;
}) {
  const [loadError, setLoadError] = useState(false);
  const isContent = photo.context === "DECLARED_CONTENT";
  const isPackaged = photo.context === "DECLARED_PACKAGED";

  return (
    <button
      type="button"
      onClick={onClickAction}
      className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#FF9900] focus:ring-offset-2 dark:border-slate-700 dark:focus:ring-offset-slate-950"
      style={{
        background: loadError
          ? "linear-gradient(135deg, #534AB7, #7F77DD)"
          : undefined,
      }}
    >
      {!loadError ? (
        <img
          src={photo.url}
          alt={photo.label || ""}
          className="h-full w-full object-cover"
          onError={() => setLoadError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white">
          {isContent ? (
            <ImageIcon size={32} />
          ) : isPackaged ? (
            <Package size={32} />
          ) : (
            <ImageIcon size={32} />
          )}
        </div>
      )}

      {photo.label && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
          <div className="text-center text-[11px] font-medium text-white">
            {photo.label}
          </div>
        </div>
      )}
    </button>
  );
}

function Lightbox({
                    photos,
                    index,
                    onCloseAction,
                    onNextAction,
                    onPrevAction,
                  }: {
  photos: DealPhoto[];
  index: number;
  onCloseAction: () => void;
  onNextAction: () => void;
  onPrevAction: () => void;
}) {
  const t = useTranslations("carrierDealRequest");
  const photo = photos[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onCloseAction}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCloseAction();
        }}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label={t("photos.lightbox.close")}
      >
        <X size={20} />
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrevAction();
            }}
            className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label={t("photos.lightbox.previous")}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextAction();
            }}
            className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label={t("photos.lightbox.next")}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div
        className="max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.label || ""}
          className="max-h-[90vh] max-w-[90vw] object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {photo.label && (
          <div className="mt-3 text-center text-[12px] font-medium text-white/80">
            {photo.label}
          </div>
        )}
      </div>
    </div>
  );
}
