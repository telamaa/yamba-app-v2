import { notFound } from "next/navigation";

/**
 * panne.ts — le déclencheur de panne de la recette (cahier 01-WEB, chapitre 5.29)
 * ================================================================================
 * Le chapitre 5.29 doit vérifier la page d'erreur du site : son texte, sa référence d'incident, sa
 * phrase de réassurance dans le tunnel de réservation, et sa variante « nouvelle version publiée ».
 * Le cahier prévoit explicitement de « demander à un développeur un moyen sûr de déclencher
 * l'erreur » : le voici.
 *
 * Deux routes l'utilisent — `/[locale]/dev/erreur` (hors tunnel) et `/[locale]/bookings/dev-erreur`
 * (dans le tunnel, pour la phrase sur le paiement) — et elles répondent **page introuvable en
 * production** : la panne n'existe qu'en développement et en recette.
 *
 * `?type=chunk` lève une erreur portant la signature d'un morceau de code manquant : c'est ce que
 * produit une version publiée pendant la navigation, et la frontière d'erreur doit alors proposer
 * « Recharger la page » plutôt que « Réessayer ».
 */
export function declencherLaPanneDeRecette(type?: string): never {
  if (process.env.NODE_ENV === "production") notFound();
  if (type === "chunk") {
    const erreur = new Error("Loading chunk 4229 failed (panne simulée, recette 5.29)");
    erreur.name = "ChunkLoadError";
    throw erreur;
  }
  throw new Error("Panne simulée (recette 5.29) : cette page n'existe que hors production.");
}
