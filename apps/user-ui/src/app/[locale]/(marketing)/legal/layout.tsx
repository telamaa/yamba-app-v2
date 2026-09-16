import type { ReactNode } from "react";

/**
 * Recette 01-WEB 5.1 (WEB-ACC-5) : ce cadre est déjà DANS le <main> du groupe (marketing) —
 * un second <main> imbriqué est invalide en HTML et fait annoncer deux « contenus principaux »
 * aux lecteurs d'écran. Un simple conteneur suffit.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-white dark:bg-slate-950">{children}</div>;
}
