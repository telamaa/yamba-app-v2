"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { useImageKitUpload } from "@/hooks/useImageKitUpload";
import apiClient from "@/lib/api-client";
import type { TripDocumentDraft } from "./create-trip.types";

type Props = {
  documents: TripDocumentDraft[];
  onAddAction: (docs: TripDocumentDraft[]) => void;
  onRemoveAction: (id: string) => void;
  label?: string;
  hint?: string;
  maxDocuments?: number;
};

const MANGO = "#FF9900";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function LightboxModal({
                         url,
                         name,
                         onClose,
                       }: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
      >
        <X size={20} />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] max-w-[90vw]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        />
        <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
          <p className="truncate text-[13px] font-medium text-white">{name}</p>
        </div>
      </div>
    </div>
  );
}

export default function DocumentUpload({
                                         documents,
                                         onAddAction,
                                         onRemoveAction,
                                         label = "Proof",
                                         hint = "Ticket, itinerary...",
                                         maxDocuments = 5,
                                       }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const { upload, progress, isUploading, error, reset } =
    useImageKitUpload("/trips");

  const canAddMore = documents.length < maxDocuments;

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!canAddMore) return;

      const availableSlots = maxDocuments - documents.length;
      const filesToUpload = Array.from(files).slice(0, availableSlots);
      const newDocs: TripDocumentDraft[] = [];

      for (const file of filesToUpload) {
        const uploaded = await upload(file);
        if (uploaded) {
          newDocs.push({
            id: uploaded.fileId,
            fileId: uploaded.fileId,
            url: uploaded.url,
            name: uploaded.originalName,
            size: uploaded.sizeBytes,
            mimeType: uploaded.mimeType,
            thumbnailUrl: uploaded.thumbnailUrl,
            verificationStatus: "pending",
          });
        }
      }

      if (newDocs.length > 0) {
        onAddAction(newDocs);
      }
      reset();
      if (inputRef.current) inputRef.current.value = "";
    },
    [documents.length, onAddAction, upload, canAddMore, maxDocuments, reset]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    if (isUploading || !canAddMore) return;
    inputRef.current?.click();
  }, [isUploading, canAddMore]);

  const handleRemove = useCallback(
    async (doc: TripDocumentDraft) => {
      if (doc.fileId) {
        try {
          await apiClient.delete(`/uploads/imagekit/${doc.fileId}`, {
            requireAuth: true,
          });
        } catch (err) {
          console.warn("[Upload] Failed to delete from ImageKit:", err);
        }
      }
      onRemoveAction(doc.id);
    },
    [onRemoveAction]
  );

  const handlePreview = (doc: TripDocumentDraft) => {
    if (isImage(doc.mimeType)) {
      setLightbox({ url: doc.url, name: doc.name });
    } else {
      window.open(doc.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/jpg,image/png,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {canAddMore && (
        <div
          onClick={handleClick}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
          onDrop={handleDrop}
          className={[
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center transition-all",
            isDragging
              ? "border-[#FF9900] bg-[#FF9900]/5"
              : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
            isUploading ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="animate-spin" style={{ color: MANGO }} />
              <p className="mt-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                {progress}%
              </p>
              <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full transition-all duration-200"
                  style={{ width: `${progress}%`, background: MANGO }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload size={16} className="text-slate-400" />
              <p className="mt-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-400">
                {hint}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                PDF, JPG, PNG, HEIC · 5 Mo max
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {documents.map((doc) => {
            const Icon = isImage(doc.mimeType) ? ImageIcon : FileText;
            const imagePreview = isImage(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900/50"
              >
                {/* Thumbnail — clickable */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(doc);
                  }}
                  className="group relative h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-slate-200 dark:border-slate-700"
                  title="Preview"
                >
                  {imagePreview && doc.url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doc.thumbnailUrl ?? doc.url}
                        alt={doc.name}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800">
                      <Icon size={14} className="text-slate-400" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(doc);
                  }}
                  className="flex-1 overflow-hidden text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[12px] font-medium text-slate-900 hover:text-[#FF9900] dark:text-white">
                      {doc.name}
                    </p>
                    {doc.verificationStatus === "verified" && (
                      <ShieldCheck size={11} className="flex-shrink-0 text-green-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatSize(doc.size)}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(doc);
                  }}
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  aria-label="Remove"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
        Un billet vérifié augmente votre fiabilité de 40%.
      </p>

      {lightbox && (
        <LightboxModal
          url={lightbox.url}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
