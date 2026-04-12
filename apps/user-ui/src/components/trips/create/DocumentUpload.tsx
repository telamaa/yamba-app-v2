import { useRef } from "react";
import { Paperclip, X, FileText, Image, ShieldCheck } from "lucide-react";
import {TripDocumentDraft} from "@/components/trips/create/create-trip.types";


const MANGO = "#FF9900";
const MANGO_10 = "rgba(255,153,0,0.1)";
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
const ACCEPTED = ".pdf,.jpg,.jpeg,.png";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  return FileText;
}

export default function DocumentUpload({
                                         documents,
                                         onAddAction,
                                         onRemoveAction,
                                         label,
                                         hint,
                                       }: {
  documents: TripDocumentDraft[];
  onAddAction: (docs: TripDocumentDraft[]) => void;
  onRemoveAction: (id: string) => void;
  label: string;
  hint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newDocs: TripDocumentDraft[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_SIZE) continue;

      const isImage = file.type.startsWith("image/");

      newDocs.push({
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      });
    }

    if (newDocs.length > 0) {
      onAddAction(newDocs);
    }

    // Reset input so same file can be re-added
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <label className="mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400">
        {label}
      </label>

      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:border-[#FF9900] hover:bg-[rgba(255,153,0,0.04)] dark:border-slate-600 dark:bg-slate-800/30 dark:hover:border-[#FF9900]"
      >
        <Paperclip size={15} className="flex-shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] text-slate-500 dark:text-slate-400">
            {documents.length === 0
              ? hint
              : `${documents.length} ${documents.length > 1 ? "fichiers" : "fichier"}`}
          </div>
        </div>
        <div className="flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: MANGO_10, color: MANGO }}>
          +
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* File list */}
      {documents.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2 dark:bg-slate-900"
              >
                {doc.previewUrl ? (
                  <img
                    src={doc.previewUrl}
                    alt={doc.name}
                    className="h-8 w-8 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-800">
                    <Icon size={14} className="text-slate-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-300">
                    {doc.name}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    {formatSize(doc.size)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveAction(doc.id)}
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  aria-label="Remove"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}

          {/* Badge hint */}
          <div className="flex items-center gap-1.5 px-1 pt-0.5">
            <ShieldCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              Badge « Voyage vérifié » après validation
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
