/**
 * PickupPhotosGrid.tsx
 * ====================
 * Bloc 2 — photos du Voyageur au pickup (min 1 obligatoire).
 * VRAI upload : input file caché + preview via URL.createObjectURL.
 * La persistance R2 arrive en PR backend (le File est conservé dans le draft).
 */

"use client";

import { Camera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { PickupPhotoDraft } from "@/components/carrier/deal/deal.types";
import PickupBlock from "./PickupBlock";

const MAX_PHOTOS = 5;

type Props = {
  photos: PickupPhotoDraft[];
  onAddAction: (photo: PickupPhotoDraft) => void;
  onRemoveAction: (photoId: string) => void;
  compact?: boolean;
};

export default function PickupPhotosGrid({
                                           photos,
                                           onAddAction,
                                           onRemoveAction,
                                           compact = false,
                                         }: Props) {
  const t = useTranslations("carrierDealPickup");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Libère les object URLs au démontage (anti memory-leak)
  useEffect(() => {
    return () => {
      photos.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPicker = () => {
    if (photos.length >= MAX_PHOTOS) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const index = photos.length;
    const context =
      index === 0 ? "PICKUP_CONTENT" : index === 1 ? "PICKUP_PACKAGED" : "PICKUP_OTHER";
    const label =
      context === "PICKUP_CONTENT"
        ? t("photos.tagContent")
        : context === "PICKUP_PACKAGED"
          ? t("photos.tagPackaged")
          : t("photos.tagOther");
    onAddAction({
      id: `pickup_photo_${Date.now()}`,
      context,
      label,
      previewUrl: URL.createObjectURL(file),
      file,
    });
    e.target.value = ""; // permet de re-sélectionner le même fichier
  };

  const handleRemove = (photo: PickupPhotoDraft) => {
    if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    onRemoveAction(photo.id);
  };

  const slotCount = compact ? 3 : 4;
  const visibleSlots = Math.max(slotCount, Math.min(photos.length + 1, MAX_PHOTOS));

  return (
    <PickupBlock
      num={2}
      state={photos.length >= 1 ? "done" : "active"}
      title={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {t("photos.title")}
          <span
            className={`inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300 ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {compact ? t("photos.requiredBadgeShort") : t("photos.requiredBadge")}
          </span>
        </span>
      }
      sub={compact ? t("photos.subShort") : t("photos.sub")}
      compact={compact}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className={`grid gap-2.5 ${compact ? "grid-cols-3" : "grid-cols-4"}`}>
        {Array.from({ length: visibleSlots }).map((_, i) => {
          const photo = photos[i];
          if (photo) {
            return (
              <div
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                {photo.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt={photo.label || ""}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                {photo.label && (
                  <div className="absolute inset-x-1.5 bottom-1.5 z-10 rounded bg-black/65 px-1.5 py-0.5 text-center text-[10px] font-medium text-white">
                    {photo.label}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(photo)}
                  aria-label={t("photos.remove")}
                  className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            );
          }
          return (
            <button
              key={`empty_${i}`}
              type="button"
              onClick={openPicker}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500 transition-colors hover:border-[#FF9900] hover:bg-amber-50 hover:text-amber-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-amber-950/30"
            >
              <Camera size={20} aria-hidden="true" />
              <span>{t("photos.add")}</span>
            </button>
          );
        })}
      </div>
      {!compact && (
        <p className="mt-2.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
          {t("photos.hint")}
        </p>
      )}
    </PickupBlock>
  );
}
