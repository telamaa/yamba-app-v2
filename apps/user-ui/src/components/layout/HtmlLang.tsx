"use client";

import { useEffect } from "react";

/**
 * HtmlLang — garde `<html lang>` fidèle à la langue AFFICHÉE.
 *
 * Le rendu serveur pose déjà la bonne valeur (`app/layout.tsx`, `getLocale()`). Mais une
 * bascule FR ⇄ EN par le sélecteur de l'en-tête est une navigation CÔTÉ CLIENT : le layout
 * racine, partagé, n'est pas re-rendu, et la page passait en anglais sous un `lang="fr"`
 * (recette 01-WEB 5.1, WEB-ACC-2). Un lecteur d'écran choisit sa voix sur cet attribut, et les
 * navigateurs leur correcteur et leur traduction automatique : il doit suivre.
 */
export default function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    if (document.documentElement.lang !== locale) document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
