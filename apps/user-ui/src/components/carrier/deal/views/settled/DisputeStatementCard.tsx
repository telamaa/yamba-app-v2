/**
 * DisputeStatementCard.tsx — « Donner ma version » dans l'app (C-PR2, D55 1A)
 * ============================================================================
 * Trois états servis par `deal.dispute` : canRespond → formulaire (texte ≥ 50,
 * ≤ 5 photos, upload direct D42 vers deals/dispute/) · respondedAt → « version
 * envoyée le … » · délai passé sans réponse → « en cours de décision ».
 * Remplace le mailto de A78.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Loader2, MessageSquareText, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PHOTO_MAX_SIZE_BYTES, PHOTO_MIME_TYPES, useImageKitUpload } from "@/hooks/useImageKitUpload";
import { dealQueryKey } from "../../DealClient";
import { submitDisputeStatement, DealApiError } from "../../deal.api";
import type { DealRequest } from "../../deal.types";

const MIN_LENGTH = 50;
const MAX_LENGTH = 2000;
const MAX_PHOTOS = 5;

type Draft = { id: string; previewUrl: string; url?: string; uploading: boolean; error?: string };

export default function DisputeStatementCard({ deal, compact }: { deal: DealRequest; compact: boolean }) {
  const t = useTranslations("mediation.statement");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const dispute = deal.dispute;
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { uploadDetailed } = useImageKitUpload("/deals/dispute", { maxSizeBytes: PHOTO_MAX_SIZE_BYTES, allowedMimeTypes: PHOTO_MIME_TYPES });

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const room = MAX_PHOTOS - photos.length;
      Array.from(files)
        .slice(0, Math.max(0, room))
        .forEach((file) => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setPhotos((prev) => [...prev, { id, previewUrl: URL.createObjectURL(file), uploading: true }]);
          void uploadDetailed(file).then((r) => {
            setPhotos((prev) => prev.map((p) => (p.id !== id ? p : r.ok ? { ...p, uploading: false, url: r.file.url } : { ...p, uploading: false, error: r.error.message })));
          });
        });
    },
    [photos.length, uploadDetailed]
  );

  if (!dispute) return null;
  const pad = compact ? "p-4" : "p-5";
  const deadline = format.dateTime(new Date(dispute.responseDeadlineAt), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  const respondedAt = sentAt ?? dispute.respondedAt;
  if (respondedAt) {
    return (
      <section className={`rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/25 ${pad}`}>
        <h3 className="text-[13.5px] font-bold text-emerald-950 dark:text-emerald-100">{t("sentTitle")}</h3>
        <p className="mt-1 text-[12.5px] leading-snug text-emerald-900/85 dark:text-emerald-200/85">
          {t("sentText", { date: format.dateTime(new Date(respondedAt), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) })}
        </p>
      </section>
    );
  }

  if (!dispute.canRespond) {
    return (
      <section className={`rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 ${pad}`}>
        <p className="text-[12.5px] leading-snug text-slate-600 dark:text-slate-400">{t("closedText")}</p>
      </section>
    );
  }

  const photosReady = photos.every((p) => !!p.url && !p.uploading && !p.error);
  const canSubmit = text.trim().length >= MIN_LENGTH && text.length <= MAX_LENGTH && photosReady && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const r = await submitDisputeStatement(deal.id, { statement: text.trim(), photoUrls: photos.map((p) => p.url!).filter(Boolean) });
      setSentAt(r.respondedAt);
      toast.success(t("toastSent"));
      void queryClient.invalidateQueries({ queryKey: dealQueryKey(deal.id) });
    } catch (e) {
      toast.error(e instanceof DealApiError && e.status === 409 ? t("toastConflict") : t("toastError"));
      if (e instanceof DealApiError && e.status === 409) void queryClient.invalidateQueries({ queryKey: dealQueryKey(deal.id) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/25 ${pad}`}>
      <div className="flex items-center gap-2">
        <MessageSquareText size={16} className="text-amber-800 dark:text-amber-300" aria-hidden="true" />
        <h3 className="text-[13.5px] font-bold text-amber-950 dark:text-amber-100">{t("title")}</h3>
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-amber-900/85 dark:text-amber-200/85">{t("intro", { deadline })}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
        rows={compact ? 5 : 6}
        placeholder={t("placeholder")}
        className="mt-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none dark:border-amber-900/40 dark:bg-slate-950 dark:text-white"
      />
      <div className="mt-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>{text.trim().length < MIN_LENGTH ? t("minHint", { min: MIN_LENGTH }) : ""}</span>
        <span>{text.length} / {MAX_LENGTH}</span>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">{t("photosLabel", { max: MAX_PHOTOS })}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" className={`h-full w-full object-cover ${p.uploading || p.error ? "opacity-50" : ""}`} />
              {p.uploading && <Loader2 size={16} className="absolute inset-0 m-auto animate-spin text-slate-700" aria-hidden="true" />}
              {p.error && <span className="absolute inset-x-0 bottom-0 bg-red-600 px-1 text-[9px] font-semibold text-white">{t("uploadError")}</span>}
              <button type="button" onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))} className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-slate-700" aria-label={t("removePhoto")}>
                <X size={11} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" onClick={() => fileInput.current?.click()} className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300">
              <Camera size={18} aria-hidden="true" />
            </button>
          )}
          <input ref={fileInput} type="file" accept={PHOTO_MIME_TYPES.join(",")} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[13px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t("sending") : t("cta")}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">{t("once")}</p>
    </section>
  );
}
