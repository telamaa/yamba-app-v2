"use client";

import React, {JSX} from "react";

/**
 * Container réutilisable qui garantit un alignement parfait avec le Header.
 *
 * Source de vérité pour les dimensions de layout de l'app.
 * À utiliser partout où on veut que le contenu soit aligné avec le Header.
 *
 * Dimensions actuelles (matchant le Header):
 *  - max-width: 80rem (= max-w-7xl = 1280px)
 *  - padding horizontal: 1rem (= px-4 = 16px)
 *
 * Si un jour tu changes les dimensions, change-les ici UNE SEULE FOIS
 * et tout le layout de l'app suivra.
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
    <Component className={`mx-auto max-w-7xl px-4 ${className}`.trim()}>
      {children}
    </Component>
  );
}
