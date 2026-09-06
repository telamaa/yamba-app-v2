"use client";

/**
 * global-error.tsx — le filet du filet
 * =====================================
 * Ne se déclenche que si le layout racine lui-même casse : ni traductions, ni thème,
 * ni police ne sont disponibles, et ce fichier DOIT porter ses propres <html> et <body>.
 * D'où un texte court, écrit en dur dans les deux langues plutôt que d'espérer next-intl,
 * et un seul geste possible : recharger.
 */
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#0b1220", color: "#e2e8f0" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "18vh 24px", textAlign: "center" }} role="alert">
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(255,153,0,.18)", color: "#FFAE33", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>!</div>
          <h1 style={{ fontSize: 20, margin: "16px 0 8px" }}>Yamba est momentanément indisponible</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#94a3b8", margin: 0 }}>
            Une erreur inattendue empêche l&apos;affichage. Recharge la page dans quelques instants.
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "#64748b", margin: "6px 0 0" }}>
            An unexpected error prevents display. Please reload the page in a moment.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, border: 0, borderRadius: 999, background: "#FF9900", color: "#0b1220", fontWeight: 700, fontSize: 14, padding: "11px 22px", cursor: "pointer" }}
          >
            Recharger · Reload
          </button>
          {error.digest && <p style={{ fontSize: 11.5, color: "#475569", marginTop: 18 }}>Référence : {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
