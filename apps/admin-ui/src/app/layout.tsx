import "./global.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import React from "react";

/**
 * D84 — la police de marque du back-office, la MÊME que celle du site membre.
 *
 * Le back-office n'en déclarait aucune : il héritait de la pile système, par
 * omission du générateur, pas par choix. Or c'est l'écran où un administrateur
 * lit des montants toute la journée — il n'y a aucune raison qu'il ne soit pas
 * chez Yamba.
 *
 * `variable` et non `className` : la variable est ensuite CONSOMMÉE par
 * `fontFamily.sans` dans `tailwind.config.js`, qui garde la pile système en
 * repli. Poser la variable sans la brancher à Tailwind ne ferait rien — c'est
 * exactement le défaut que D84 corrige sur l'autre front.
 */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Yamba — Back-office",
  description: "Médiation, journal et pilotage (chantier C)",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={plusJakarta.variable}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
