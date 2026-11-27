"use client";

import React, {JSX} from "react";
import { conteneurDePage } from "@/lib/layout/largeur-de-page";

/**
 * Container réutilisable qui garantit un alignement parfait avec le Header.
 *
 * À utiliser partout où on veut que le contenu soit aligné avec le Header.
 *
 * LA SOURCE DE VÉRITÉ N'EST PLUS CE FICHIER (D110). Les dimensions vivent
 * dans `@/lib/layout/largeur-de-page`, module PUR qu'une fiche exécute. Ce
 * composant en est un consommateur comme un autre — le plus commode quand on
 * a un sous-arbre à envelopper, là où `conteneurDePage()` suffit quand on a
 * déjà un élément sous la main.
 *
 * Ce fichier a longtemps dit « Source de vérité […] change-les ici UNE SEULE
 * FOIS et tout le layout de l'app suivra ». C'était juste, et faux : au
 * 21/11 un seul fichier l'importait, pendant que `max-w-7xl` était recopié
 * 51 fois dans 37 fichiers, avec CINQ gouttières. Une source de vérité que
 * personne n'importe n'est pas une source de vérité, c'est un commentaire —
 * d'où la fiche qui interdit désormais le littéral partout ailleurs.
 *
 * @example
 * <AppContainer>
 *   <h1>Mon contenu</h1>
 * </AppContainer>
 *
 * @example
 * // Avec padding vertical ou classes custom
 * <AppContainer className="py-8">
 *   ...
 * </AppContainer>
 */

type Props = {
  children: React.ReactNode;
  /** Classes additionnelles (ex: padding vertical, background, etc.) */
  className?: string;
  /** HTML element à utiliser (par défaut: "div") */
  as?: keyof JSX.IntrinsicElements;
};

export default function AppContainer({
                                       children,
                                       className = "",
                                       as: Component = "div",
                                     }: Props) {
  return (
    <Component className={conteneurDePage(className)}>
      {children}
    </Component>
  );
}
