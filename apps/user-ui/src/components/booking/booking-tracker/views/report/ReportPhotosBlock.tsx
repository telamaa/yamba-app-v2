/**
 * ReportPhotosBlock.tsx
 * =====================
 * Photos de preuve du litige — upload réel (URL.createObjectURL, File
 * conservé pour R2). Gradient ROUGE : le 3e pilier du langage visuel
 * (violet=déclaration Shipper, amber=pickup Carrier, ROUGE=preuves litige).
 */

"use client";

import { Camera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import {
  DISPUTE_MAX_PHOTOS,
  type DisputePhotoDraft,
} from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  photos: DisputePhotoDraft[];
  recipientFirstName: string;
  onAddAction: (photo: DisputePhotoDraft) => void;
  onRemoveAction: (photoId: string) => void;
  compact?: boolean;
};

export default function ReportPhotosBlock({
                                            photos,
                                            recipientFirstName,
                                            onAddAction,
                                            onRemoveAction,
                                            compact = false,
                                          }: Props) {
  const t = useTranslations("bookingTracker");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      photos.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPicker = () => {
    if (photos.length >= DISPUTE_MAX_PHOTOS) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onAddAction({
      id: "dispute_photo_" + Date.now(),
      label: t("report.photos.tag"),
      previewUrl: URL.createObjectURL(file),
      file,
    });
    e.target.value = "";
  };

  const handleRemove = (photo: DisputePhotoDraft) => {
    if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    onRemoveAction(photo.id);
  };

  const slotCount = compact ? 3 : 5;
  const visibleSlots = Math.max(
    slotCount,
    Math.min(photos.length + 1, DISPUTE_MAX_PHOTOS)
  );
  const gridClass = "grid gap-2.5 " + (compact ? "grid-cols-3" : "grid-cols-5");

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className={gridClass}>
        {Array.from({ length: visibleSlots }).map((_, i) => {
          const photo = photos[i];
          if (photo) {
            return (
              <div
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-xl"
                style={{ background: "linear-gradient(135deg, #A32D2D, #E24B4A)" }}
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
                  aria-label={t("report.photos.remove")}
                  className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            );
          }
          return (
            <button
              key={"empty_" + i}
              type="button"
              onClick={openPicker}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-red-950/30"
            >
              <Camera size={compact ? 16 : 20} aria-hidden="true" />
              <span>{t("report.photos.add")}</span>
            </button>
          );
        })}
      </div>

      <p
        className={
          "mt-2.5 leading-snug text-slate-500 dark:text-slate-400 " +
          (compact ? "text-[11px]" : "text-[12px]")
        }
      >
        {t("report.photos.hint", {
          recipientFirstName,
          max: DISPUTE_MAX_PHOTOS,
        })}
      </p>
    </div>
  );
}
