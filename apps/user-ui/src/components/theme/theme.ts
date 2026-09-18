/**
 * theme.ts — la règle du thème, partagée entre le script anti-flash (serveur) et le provider (client)
 * ====================================================================================================
 * Remplace `next-themes` (recette manuelle du 18/09/2026). La bibliothèque rendait son script
 * anti-flash comme UN ÉLÉMENT REACT à l'intérieur d'un composant client : dès que ce sous-arbre est
 * (re)monté côté client, React 19.2 signale « Encountered a script tag while rendering React
 * component » — un script créé par React côté client ne s'exécute jamais. La parade d'alors
 * (monter le provider dans le layout racine « qui ne se remonte jamais », voir l'historique du
 * commentaire de `app/layout.tsx`) ÉVITAIT l'avertissement au lieu de le rendre impossible : la
 * recette l'a revu à l'écran. Aucune version corrigée de next-themes n'est publiée (0.4.6,
 * mars 2025).
 *
 * Ici, le script est une CHAÎNE, rendue par le layout RACINE — un composant serveur : son HTML est
 * adopté à l'hydratation et échappe à tout remontage client. Plus aucun `<script>` ne vit dans un
 * composant client. Une limite, vue à l'écran le 18/09 : une HYDRATATION QUI ÉCHOUE fait régénérer
 * l'arbre entier par React, script compris — l'avertissement y redevient possible, mais comme
 * symptôme de l'écart d'hydratation lui-même, à corriger à sa source.
 *
 * Sémantique conservée à l'identique (mêmes réglages que l'ancien provider) :
 * clé de stockage `theme` (les préférences déjà enregistrées survivent au remplacement),
 * défaut `light`, `system` suivi via `prefers-color-scheme`, classe `light`/`dark` sur <html>
 * (stratégie Tailwind), `color-scheme` posé pour les composants natifs (ascenseurs, formulaires).
 */

export const THEME_STORAGE_KEY = "theme";
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ThemeResolu = "light" | "dark";
export const DEFAULT_THEME: Theme = "light";

export function estUnTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * Le script anti-flash — exécuté pendant le PARSE du HTML, avant le premier rendu du contenu,
 * donc avant tout éclair de thème. Il doit rester autonome (aucune référence extérieure) et
 * refléter EXACTEMENT la résolution du provider : stocké invalide ou absent → `light` ;
 * `system` → média query. `try/catch` : localStorage peut lever (navigation privée, stockage bloqué).
 */
export function themeInitScript(): string {
  return (
    "(function(){var t;try{t=localStorage.getItem(" +
    JSON.stringify(THEME_STORAGE_KEY) +
    ")}catch(e){}" +
    'if(t!=="light"&&t!=="dark"&&t!=="system")t=' +
    JSON.stringify(DEFAULT_THEME) +
    ";" +
    'var r=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;' +
    "var c=document.documentElement.classList;" +
    'c.remove("light","dark");c.add(r);' +
    "document.documentElement.style.colorScheme=r;" +
    "})()"
  );
}
