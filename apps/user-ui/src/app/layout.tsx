import "./global.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import React from "react";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { themeInitScript } from "@/components/theme/theme";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Yamba",
  description: "Yamba description",
};

/**
 * Root layout — MUST contain <html> and <body> tags (Next.js 16 requirement).
 *
 * The <html lang="..."> attribute carries the REQUEST locale (`getLocale()`, resolved by
 * next-intl from the `[locale]` segment / middleware). It used to be hard-coded to "fr" with a
 * promise that the locale layout would update it — nothing ever did (recette 01-WEB 5.1,
 * WEB-ACC-2 : `/en` was served with `lang="fr"`).
 *
 * All providers and UI chrome are in app/[locale]/layout.tsx — SAUF le thème, qui vit ICI :
 *
 * - le <script> anti-flash est rendu par CE layout (composant SERVEUR, premier enfant du <body>) :
 *   son HTML est adopté à l'hydratation et n'est jamais recréé par React côté client. C'est ce qui
 *   rend IMPOSSIBLE l'avertissement React 19 « Encountered a script tag while rendering React
 *   component » — next-themes, lui, rendait ce script DANS un composant client, et la parade
 *   précédente (« le root layout ne se remonte jamais ») ne faisait que l'éviter : la recette
 *   manuelle du 18/09 l'a revu à l'écran, et la bibliothèque n'a pas de version corrigée.
 * - le ThemeProvider (maison, `components/theme/`) reste au-dessus du segment [locale] pour que la
 *   bascule FR/EN ne perde pas l'état du thème.
 */
export default async function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={plusJakarta.variable} suppressHydrationWarning>
    <body className="min-h-screen bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
    {/* Anti-flash : s'exécute pendant le parse, avant tout contenu — voir theme.ts */}
    <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
    <ThemeProvider>{children}</ThemeProvider>
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{ duration: 6000 }}
    />
    </body>
    </html>
  );
}
