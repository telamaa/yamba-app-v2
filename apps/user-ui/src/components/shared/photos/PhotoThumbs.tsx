"use client";

/**
 * PhotoThumbs.tsx — vignettes RÉELLES de photos de colis + visionneuse (A48)
 * ===========================================================================
 * Remplace les carrés de couleur à pictogramme hérités des mocks : chaque
 * vignette affiche l'image (object-cover), un liseré de la couleur du
 * moment (violet = déclarées, amber = pickup, rouge = litige — spec §3.4),
 * s'ouvre en plein écran au clic (PhotoLightbox). Image en erreur →
 * dégradé + pictogramme (jamais une case vide). `max` tronque avec « +N ».
 * Cibles ≥ 40 px (mobile-first).
 */

import { ImageIcon, Package } from "lucide-react";
import { useState } from "react";
import PhotoLightbox, { type ViewerPhoto } from "./PhotoLightbox";

export type ThumbPhoto = ViewerPhoto & { context?: string };

type Tone = "violet" | "amber" | "red";
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { box: string; icon: number }> = {
  sm: { box: "h-10 w-10 rounded-md", icon: 14 },
  md: { box: "h-12 w-12 rounded-lg sm:h-14 sm:w-14", icon: 16 },
  lg: { box: "h-16 w-16 rounded-lg", icon: 20 },
};

const GRADIENT: Record<Tone, string> = {
  violet: "linear-gradient(135deg, #534AB7, #7F77DD)",
  amber: "linear-gradient(135deg, #BA7517, #EF9F27)",
  red: "linear-gradient(135deg, #A32D2D, #E24B4A)",
};

const RING: Record<Tone, string> = {
  violet: "ring-violet-500/60",
  amber: "ring-amber-500/70",
  red: "ring-red-500/60",
};

type Props = {
  photos: ThumbPhoto[];
  tone: Tone;
  size?: Size;
  /** Nombre max de vignettes ; les suivantes deviennent « +N » (ouvre la visionneuse). */
  max?: number;
  className?: string;
};

export default function PhotoThumbs({ photos, tone, size = "md", max, className = "" }: Props) {
  const [active, setActive] = useState<number | null>(null);
  if (photos.length === 0) return null;

  const visible = max ? photos.slice(0, max) : photos;
  const hidden = photos.length - visible.length;

  return (
    <>
      <div className={"flex flex-wrap gap-2 " + className}>
        {visible.map((photo, i) => (
          <Thumb key={photo.id} photo={photo} tone={tone} size={size} onOpenAction={() => setActive(i)} />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setActive(visible.length)}
            className={
              SIZE[size].box +
              " flex flex-shrink-0 items-center justify-center bg-slate-100 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
            }
            aria-label={`+${hidden}`}
          >
            +{hidden}
          </button>
        )}
      </div>
      {active !== null && (
        <PhotoLightbox
          photos={photos}
          index={active}
          onCloseAction={() => setActive(null)}
          onIndexChangeAction={setActive}
        />
      )}
    </>
  );
}

function Thumb({
  photo,
  tone,
  size,
  onOpenAction,
}: {
  photo: ThumbPhoto;
  tone: Tone;
  size: Size;
  onOpenAction: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const isPackaged = photo.context?.endsWith("PACKAGED") ?? false;
  return (
    <button
      type="button"
      onClick={onOpenAction}
      className={
        SIZE[size].box +
        " relative flex-shrink-0 overflow-hidden ring-2 transition-transform hover:scale-[1.04] focus:outline-none focus-visible:ring-[#FF9900] " +
        RING[tone]
      }
      style={failed ? { background: GRADIENT[tone] } : undefined}
      aria-label={photo.label || "photo"}
      title={photo.label}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={photo.label || ""}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white">
          {isPackaged ? <Package size={SIZE[size].icon} /> : <ImageIcon size={SIZE[size].icon} />}
        </span>
      )}
    </button>
  );
}
