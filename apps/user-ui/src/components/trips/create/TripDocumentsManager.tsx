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
  ExternalLink,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useImageKitUpload } from "@/hooks/useImageKitUpload";
import apiClient from "@/lib/api-client";

type TripDocument = {
  id: string;
  type: string;
  fileId: string;
  url: string;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  // Prisma field is `status`, but we accept both for compatibility
  status?: "PENDING" | "VERIFIED" | "REJECTED";
  verificationStatus?: "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED";
};

type Props = {
  tripId: string;
  documents: TripDocument[];
  isFr: boolean;
  maxDocuments?: number;
  canEdit?: boolean;
};

const MANGO = "#FF9900";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

function getStatus(doc: TripDocument): "PENDING" | "VERIFIED" | "REJECTED" {
  return (doc.status || doc.verificationStatus || "PENDING") as any;
}

/* ── Lightbox for image preview ─────────────── */

function LightboxModal({
                         url,
                         name,
                         onClose,
                         isFr,
                       }: {
  url: string;
  name: string;
  onClose: () => void;
  isFr: boolean;
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
        aria-label={isFr ? "Fermer" : "Close"}
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

/* ── Main component ─────────────────────────── */

export default function TripDocumentsManager({
                                               tripId,
                                               documents,
                                               isFr,
                                               maxDocuments = 5,
                                               canEdit = true,
                                             }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const toastOpts = { duration: 6000, closeButton: true };

  const { upload, progress, isUploading, error, reset } =
    useImageKitUpload("/trips");

  const canAddMore = documents.length < maxDocuments && canEdit;

  const addDocs = useMutation({
    mutationFn: async (newDocs: any[]) => {
      await apiClient.post(
        `/trips/${tripId}/documents`,
        { documents: newDocs },
        { requireAuth: true }
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trip", tripId] });
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
      toast.success(
        isFr ? "Document(s) ajouté(s)" : "Document(s) added",
        toastOpts
      );
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        (isFr ? "Erreur lors de l'ajout" : "Failed to add document");
      toast.error(msg, toastOpts);
    },
  });

  const removeDoc = useMutation({
    mutationFn: async (docId: string) => {
      await apiClient.delete(`/trips/${tripId}/documents/${docId}`, {
        requireAuth: true,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trip", tripId] });
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
      toast.success(
        isFr ? "Document supprimé" : "Document removed",
        toastOpts
      );
    },
    onError: () => {
      toast.error(
        isFr ? "Erreur lors de la suppression" : "Failed to remove",
        toastOpts
      );
    },
  });

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !canAddMore) return;

      const availableSlots = maxDocuments - documents.length;
      const filesToUpload = Array.from(files).slice(0, availableSlots);
      const uploadedDocs: any[] = [];

      for (const file of filesToUpload) {
        const uploaded = await upload(file);
        if (uploaded) {
          uploadedDocs.push({
            type: "TICKET_PROOF",
            fileId: uploaded.fileId,
            url: uploaded.url,
            originalName: uploaded.originalName,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          });
        }
      }

      if (uploadedDocs.length > 0) {
        addDocs.mutate(uploadedDocs);
      }
      reset();
      if (inputRef.current) inputRef.current.value = "";
    },
    [documents.length, upload, canAddMore, maxDocuments, reset, addDocs]
  );

  const handleClick = () => {
    if (isUploading || !canAddMore) return;
    inputRef.current?.click();
  };

  const handleRemove = (doc: TripDocument) => {
    removeDoc.mutate(doc.id);
  };

  const handlePreview = (doc: TripDocument) => {
    if (isImage(doc.mimeType)) {
      setLightbox({ url: doc.url, name: doc.originalName ?? "Document" });
    } else {
      // PDFs and other files: open in new tab
      window.open(doc.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div>
      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/jpg,image/png,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {/* Upload zone */}
      {canAddMore && (
        <div
          onClick={handleClick}
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={[
            "mb-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center transition-all",
            isDragging
              ? "border-[#FF9900] bg-[#FF9900]/5"
              : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600",
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
                <div className="h-full transition-all" style={{ width: `${progress}%`, background: MANGO }} />
              </div>
            </>
          ) : (
            <>
              <Upload size={16} className="text-slate-400" />
              <p className="mt-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-400">
                {isFr ? "Ajouter un billet ou justificatif" : "Add a ticket or proof"}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                PDF, JPG, PNG, HEIC · 5 Mo max
              </p>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      )}

      {/* Documents list */}
      {documents.length > 0 ? (
        <div className="space-y-1.5">
          {documents.map((doc) => {
            const Icon = isImage(doc.mimeType) ? ImageIcon : FileText;
            const status = getStatus(doc);
            const imagePreview = isImage(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800"
              >
                {/* Thumbnail / Icon — clickable for preview */}
                <button
                  type="button"
                  onClick={() => handlePreview(doc)}
                  className="group relative h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-slate-200 dark:border-slate-700"
                  title={isFr ? "Prévisualiser" : "Preview"}
                >
                  {imagePreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doc.url}
                        alt={doc.originalName ?? ""}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800">
                      <Icon size={18} className="text-slate-400" />
                    </div>
                  )}
                </button>

                <div className="flex-1 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handlePreview(doc)}
                    className="block max-w-full text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[12px] font-medium text-slate-900 hover:text-[#FF9900] dark:text-white">
                        {doc.originalName ?? "Document"}
                      </p>
                      {status === "VERIFIED" && (
                        <ShieldCheck size={11} className="flex-shrink-0 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                      <span>{formatSize(doc.sizeBytes)}</span>
                      <span>·</span>
                      {status === "PENDING" && (
                        <span className="text-amber-500">
                          {isFr ? "En vérification" : "Pending"}
                        </span>
                      )}
                      {status === "VERIFIED" && (
                        <span className="text-green-500">
                          {isFr ? "Vérifié" : "Verified"}
                        </span>
                      )}
                      {status === "REJECTED" && (
                        <span className="text-red-500">
                          {isFr ? "Rejeté" : "Rejected"}
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title={isFr ? "Ouvrir dans un nouvel onglet" : "Open in new tab"}
                >
                  <ExternalLink size={12} />
                </a>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemove(doc)}
                    disabled={removeDoc.isPending}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-500/10"
                    aria-label="Remove"
                  >
                    {removeDoc.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <X size={12} />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !canAddMore && (
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            {isFr ? "Aucun document" : "No documents"}
          </p>
        )
      )}

      {canEdit && (
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          {isFr
            ? "Un billet vérifié augmente votre fiabilité de 40%."
            : "A verified ticket increases your trust score by 40%."}
        </p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <LightboxModal
          url={lightbox.url}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
          isFr={isFr}
        />
      )}
    </div>
  );
}
