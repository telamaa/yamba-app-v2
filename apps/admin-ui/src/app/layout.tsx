import "./global.css";
import React from "react";

export const metadata = {
  title: "Yamba — Back-office",
  description: "Médiation, journal et pilotage (chantier C)",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
