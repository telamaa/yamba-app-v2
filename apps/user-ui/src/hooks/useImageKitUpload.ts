"use client";

import { useCallback, useState } from "react";
import apiClient from "@/lib/api-client";

export type UploadedFile = {
  fileId: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl?: string;
};

export type UploadError = {
  code: "AUTH_FAILED" | "UPLOAD_FAILED" | "INVALID_TYPE" | "TOO_LARGE" | "UNKNOWN";
  message: string;
};

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

type AuthParams = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
};

async function fetchAuthParams(): Promise<AuthParams> {
  const response = await apiClient.get("/uploads/imagekit-auth", {
    requireAuth: true,
  });
  console.log("[ImageKit] Auth params received:", {
    hasToken: !!response.data.token,
    hasSignature: !!response.data.signature,
    expire: response.data.expire,
    publicKey: response.data.publicKey,
    urlEndpoint: response.data.urlEndpoint,
  });
  return {
    token: response.data.token,
    expire: response.data.expire,
    signature: response.data.signature,
    publicKey: response.data.publicKey,
    urlEndpoint: response.data.urlEndpoint,
  };
}

export function useImageKitUpload(folder = "/trips") {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  const validateFile = useCallback((file: File): UploadError | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return {
        code: "INVALID_TYPE",
        message: "Format non supporté. Utilisez PDF, JPG, PNG ou HEIC.",
      };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return {
        code: "TOO_LARGE",
        message: "Le fichier dépasse 5 Mo.",
      };
    }
    return null;
  }, []);

  const upload = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      setError(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return null;
      }

      setIsUploading(true);
      setProgress(0);

      try {
        const auth = await fetchAuthParams();

        // Validate auth params before upload
        if (!auth.publicKey || !auth.token || !auth.signature || !auth.expire) {
          throw new Error(
            `Missing auth parameters: publicKey=${!!auth.publicKey}, token=${!!auth.token}, signature=${!!auth.signature}, expire=${auth.expire}`
          );
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", file.name);
        formData.append("publicKey", auth.publicKey);
        formData.append("signature", auth.signature);
        formData.append("expire", String(auth.expire));
        formData.append("token", auth.token);
        formData.append("useUniqueFileName", "true");
        if (folder) {
          formData.append("folder", folder);
        }

        console.log("[ImageKit] Uploading:", {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          folder,
        });

        const uploadResult = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "https://upload.imagekit.io/api/v1/files/upload");

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setProgress(percent);
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new Error("Invalid response from ImageKit"));
              }
            } else {
              // Log the full error response from ImageKit
              console.error("[ImageKit] Upload failed:", {
                status: xhr.status,
                statusText: xhr.statusText,
                response: xhr.responseText,
              });

              let errorMessage = `Upload failed (${xhr.status})`;
              try {
                const errorBody = JSON.parse(xhr.responseText);
                errorMessage = errorBody.message || errorBody.help || errorMessage;
              } catch {
                // response was not JSON
                if (xhr.responseText) errorMessage = xhr.responseText;
              }
              reject(new Error(errorMessage));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

          xhr.send(formData);
        });

        return {
          fileId: uploadResult.fileId,
          url: uploadResult.url,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          thumbnailUrl: uploadResult.thumbnailUrl,
        };
      } catch (err: any) {
        const uploadError: UploadError = {
          code: err.message?.includes("auth") ? "AUTH_FAILED" : "UPLOAD_FAILED",
          message: err.message ?? "Erreur lors du téléchargement.",
        };
        setError(uploadError);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [folder, validateFile]
  );

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
    setIsUploading(false);
  }, []);

  return {
    upload,
    progress,
    isUploading,
    error,
    reset,
    validateFile,
  };
}
