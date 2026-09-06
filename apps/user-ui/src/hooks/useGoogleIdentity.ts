"use client";

/**
 * useGoogleIdentity — Google Identity Services (D47)
 * ==================================================
 * Charge le script GIS UNE fois, initialise le client avec
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID et rend le bouton officiel dans un conteneur.
 * Le bouton officiel est le seul chemin fiable pour obtenir un id_token
 * depuis un clic (le « One Tap » `prompt()` est soumis à des cooldowns).
 * Sans client ID → `configured: false`, le composant affiche un bouton inerte.
 */
import { useEffect, useRef, useState } from "react";

type CredentialResponse = { credential: string; select_by?: string };

type GsiButtonConfig = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: CredentialResponse) => void; ux_mode?: "popup" | "redirect"; itp_support?: boolean }) => void;
          renderButton: (parent: HTMLElement, options: GsiButtonConfig) => void;
        };
      };
    };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiLoading: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiLoading) {
    gsiLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gsiLoading = null;
        reject(new Error("gsi load failed"));
      };
      document.head.appendChild(script);
    });
  }
  return gsiLoading;
}

export type UseGoogleIdentityOptions = {
  onCredentialAction: (credential: string) => void;
  locale: string;
  text?: GsiButtonConfig["text"];
};

export function useGoogleIdentity({ onCredentialAction, locale, text = "continue_with" }: UseGoogleIdentityOptions) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onCredentialAction);
  callbackRef.current = onCredentialAction;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => callbackRef.current(r.credential),
          ux_mode: "popup",
          itp_support: true,
        });
        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "pill",
          logo_alignment: "center",
          width: Math.min(400, Math.floor(containerRef.current.clientWidth || 360)),
          locale,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, locale, text]);

  return { containerRef, configured: Boolean(clientId), ready, failed };
}
