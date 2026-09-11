/**
 * compte-neuf.ts — un compte créé sur place, pour les parcours du « compte neuf » (WEB-E2E-4)
 * ==========================================================================================
 * Le cahier crée le compte pendant le parcours ; il ne vient pas du seed. Une adresse unique
 * par exécution (Mailpit accepte tout domaine), le mot de passe commun de recette, et un
 * prénom qui se lit dans les emails. Rien ici n'est un secret : ces comptes ne vivent que sur
 * la base de développement.
 */
import { MOT_DE_PASSE_SEED } from "./comptes";

export interface CompteNeuf {
  email: string;
  prenom: string;
  nom: string;
  motDePasse: string;
}

export function compteNeuf(prenom = "Nadège", nom = "Okemba"): CompteNeuf {
  const horodatage = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return { email: `neuf-${horodatage}@recette.yamba.dev`, prenom, nom, motDePasse: MOT_DE_PASSE_SEED };
}
