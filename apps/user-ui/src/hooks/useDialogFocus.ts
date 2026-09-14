"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * useDialogFocus — le focus d'une fenêtre modale (chapitre 5.31, ANO-WEB-94)
 * ===========================================================================
 * Une fenêtre `role="dialog" aria-modal="true"` promet trois choses au clavier et aux lecteurs
 * d'écran (WCAG 2.4.3 « parcours du focus ») :
 *  1. à l'ouverture, le focus ENTRE dans la fenêtre (sauf si un enfant l'y a déjà mis) ;
 *  2. tant qu'elle est ouverte, Tab et Maj+Tab BOUCLENT à l'intérieur — la page du dessous est
 *     inerte, y tabuler revient à agir à l'aveugle derrière un voile ;
 *  3. à la fermeture, le focus REVIENT sur ce qui l'a ouverte (sinon il retombe sur `<body>` et
 *     le membre au clavier recommence la page depuis le début).
 *
 * Les fenêtres peuvent s'empiler (une confirmation au-dessus d'un formulaire) : seule la plus
 * haute tient le focus, d'où la pile de module.
 *
 * Usage : `const ref = useRef<HTMLDivElement>(null); useDialogFocus(ref, open);` et `ref` posé sur
 * l'élément qui porte `role="dialog"`. Pour une fenêtre montée seulement quand elle est ouverte,
 * `active` vaut `true` par défaut. `onEscape` (facultatif) ferme la fenêtre sur Échap — seulement
 * la plus haute de la pile : une confirmation ouverte au-dessus se ferme seule.
 */

const FOCUSABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Pile des fenêtres ouvertes : la dernière est la seule à tenir le focus. */
const pile: HTMLElement[] = [];

function focalisables(conteneur: HTMLElement): HTMLElement[] {
  return Array.from(conteneur.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
    // Un élément masqué (display:none, ancêtre replié) n'a aucune boîte : il ne reçoit pas le focus.
    (el) => el.getClientRects().length > 0 && !el.closest("[inert]")
  );
}

export function useDialogFocus(ref: RefObject<HTMLElement | null>, active = true, onEscape?: () => void): void {
  // Les appelants passent souvent une flèche en ligne (`() => setOpen(false)`) : nouvelle à chaque
  // rendu. En dépendance de l'effet, elle le relancerait à chaque frappe — et son nettoyage rendrait
  // le focus à l'ouvreur EN PLEINE SAISIE. On lit donc la dernière version par une référence.
  const surEchap = useRef(onEscape);
  useEffect(() => {
    surEchap.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const conteneur = ref.current;
    if (!conteneur) return;

    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pile.push(conteneur);

    // Une image plus tard : les enfants qui posent leur propre focus initial (champ, bouton
    // principal) ont la priorité ; on n'intervient que si le focus est resté dehors.
    const raf = requestAnimationFrame(() => {
      if (conteneur.contains(document.activeElement)) return;
      const premier = focalisables(conteneur)[0];
      if (premier) premier.focus();
      else {
        if (!conteneur.hasAttribute("tabindex")) conteneur.setAttribute("tabindex", "-1");
        conteneur.focus();
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (pile[pile.length - 1] !== conteneur) return;
      if (e.key === "Escape" && surEchap.current) {
        surEchap.current();
        return;
      }
      if (e.key !== "Tab") return;
      const liste = focalisables(conteneur);
      if (liste.length === 0) {
        e.preventDefault();
        return;
      }
      const premier = liste[0];
      const dernier = liste[liste.length - 1];
      const actif = document.activeElement;
      const dehors = !conteneur.contains(actif);
      if (e.shiftKey && (actif === premier || dehors)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && (actif === dernier || dehors)) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      const i = pile.lastIndexOf(conteneur);
      if (i >= 0) pile.splice(i, 1);
      // On ne vole pas un focus que le membre a posé AILLEURS entre-temps (navigation, autre champ) :
      // on ne rend la main que s'il est encore dans la fenêtre ou retombé sur <body>.
      const actif = document.activeElement;
      const perdu = !actif || actif === document.body || conteneur.contains(actif);
      if (perdu && origine && origine.isConnected) origine.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
