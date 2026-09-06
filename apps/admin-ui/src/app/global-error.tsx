"use client";

/** Le filet du filet du back-office : le layout racine lui-même a cassé. */
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function AdminGlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "18vh 24px" }} role="alert">
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Le back-office est momentanément indisponible</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#475569", margin: 0 }}>Une erreur inattendue empêche l&apos;affichage. Recharge la page dans quelques instants.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 20, border: 0, borderRadius: 8, background: "#0f172a", color: "#fff", fontWeight: 600, fontSize: 14, padding: "10px 18px", cursor: "pointer" }}>Recharger</button>
          {error.digest && <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 18 }}>Référence : {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
