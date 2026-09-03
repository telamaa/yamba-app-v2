/**
 * DeliverPhotosBlock.tsx — photos OPTIONNELLES de la remise (B4-PR3, A76)
 * ======================================================================
 * Le code prouve la remise, la photo prouve l'état : c'est l'assurance du
 * Voyageur en cas de litige « endommagé ». Jamais obligatoire (2 max).
 * Même cycle que les preuves de litige : upload à la sélection, vignette
 * « envoi… » puis nette, erreur rouge ; le parent bloque la validation tant
 * qu'une photo est en cours ou en échec.
 */
"use client";

import { AlertCircle, Camera, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { DELIVERY_PHOTOS_MAX, type DeliveryPhotoDraft } from "@/components/carrier/deal/deal.types";

type Props = {
  photos: DeliveryPhotoDraft[];
  onAddAction: (photo: DeliveryPhotoDraft) => void;
  onRemoveAction: (photoId: string) => void;
  compact?: boolean;
};

export default function DeliverPhotosBlock({ photos, onAddAction, onRemoveAction, compact = false }: Props) {
  const t = useTranslations("carrierDealDeliver");
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
    if (photos.length >= DELIVERY_PHOTOS_MAX) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onAddAction({ id: "delivery_photo_" + Date.now(), previewUrl: URL.createObjectURL(file), file });
    e.target.value = "";
  };

  const slots = Math.min(Math.max(photos.length + 1, 2), DELIVERY_PHOTOS_MAX);

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-white">{t("photos.title")}</h3>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
            {compact ? t("photos.subShort") : t("photos.sub")}
          </p>
        </div>
        <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {t("photos.optional")}
        </span>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: slots }).map((_, i) => {
          const photo = photos[i];
          if (photo) {
            return (
              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl bg-amber-100 dark:bg-amber-950/40">
                {photo.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url ?? photo.previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {photo.uploading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 text-white" aria-live="polite">
                    <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                    <span className="sr-only">{t("photos.uploading")}</span>
                  </div>
                )}
                {photo.error && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-red-900/80 px-1.5 text-center text-white" title={photo.error}>
                    <AlertCircle size={16} aria-hidden="true" />
                    <span className="text-[10px] font-semibold leading-tight">{t("photos.uploadError")}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAction(photo.id)}
                  aria-label={t("photos.remove")}
                  className="absolute right-1.5 top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
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
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500 transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-amber-950/30"
            >
              <Camera size={compact ? 16 : 20} aria-hidden="true" />
              <span>{t("photos.add")}</span>
            </button>
          );
        })}
      </div>
      <p className={`mt-2.5 leading-snug text-slate-500 dark:text-slate-400 ${compact ? "text-[11px]" : "text-[12px]"}`}>
        {t("photos.hint", { max: DELIVERY_PHOTOS_MAX })}
      </p>
    </section>
  );
}
