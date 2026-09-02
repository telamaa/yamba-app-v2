/**
 * DealParcelPhotos.tsx
 * ====================
 * Grid de photos déclarées par l'expéditeur ; visionneuse partagée
 * (PhotoLightbox — A48) au clic.
 *
 * Layout responsive :
 *  - Mobile : 2 cols (photos lisibles ~170px pour juger le contenu)
 *  - Tablet : 3 cols
 *  - Desktop : 4 cols
 *
 * Partagé entre les views request (PENDING) et accepted (ACCEPTED).
 */

"use client";

import { ImageIcon, Package } from "lucide-react";
import PhotoLightbox from "@/components/shared/photos/PhotoLightbox";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import type { DealPhoto } from "../deal.types";

type Props = {
  photos: DealPhoto[];
  shipperFirstName: string;
};

export default function DealParcelPhotos({ photos, shipperFirstName }: Props) {
  const t = useTranslations("carrierDealRequest");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const open = useCallback((idx: number) => setActiveIndex(idx), []);
  const close = useCallback(() => setActiveIndex(null), []);

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
        <PhotoLightbox
          photos={photos}
          index={activeIndex}
          onCloseAction={close}
          onIndexChangeAction={setActiveIndex}
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
