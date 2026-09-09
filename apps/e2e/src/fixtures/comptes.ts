/**
 * comptes.ts — les comptes du jeu d'essai (RECETTE-01-WEB § 2.3)
 * ==============================================================
 * Le mot de passe est commun à tous les comptes du seed et n'a rien d'un secret : il est écrit
 * en clair dans `packages/libs/prisma/scripts/seed-deals.ts`, dans le cahier de recette, et il
 * ne vaut que sur une base de développement. Le garde-fou anti-fuite de la CI ne s'y trompe
 * pas : ce fichier ne contient aucune clé, aucun jeton, aucune adresse réelle.
 */

export const MOT_DE_PASSE_SEED = "Yamba-Dev-2026!";
/** Code de livraison de tout deal du seed déjà pris en charge (§ 2.5). */
export const CODE_LIVRAISON_SEED = "742891";

export interface Compte {
  cle: string;
  email: string;
  prenom: string;
  nom: string;
  /** Ce que le compte porte dans le jeu d'essai — recopié du cahier, pour se relire. */
  role: "VOYAGEUR" | "EXPEDITEUR";
}

const voyageur = (cle: string, email: string, prenom: string, nom: string): Compte => ({ cle, email, prenom, nom, role: "VOYAGEUR" });
const expediteur = (cle: string, email: string, prenom: string, nom: string): Compte => ({ cle, email, prenom, nom, role: "EXPEDITEUR" });

export const COMPTES = {
  // Les six Voyageurs — onboarding et Stripe complets, ils peuvent accepter sans passer par Stripe.
  thomas: voyageur("thomas", "thomas.carrier@seed.yamba.dev", "Thomas", "Nkounkou"),
  marc: voyageur("marc", "marc.carrier@seed.yamba.dev", "Marc", "Tremblay"),
  ines: voyageur("ines", "ines.carrier@seed.yamba.dev", "Inês", "Ferreira"),
  adebayo: voyageur("adebayo", "adebayo.carrier@seed.yamba.dev", "Adebayo", "Okonkwo"),
  linh: voyageur("linh", "linh.carrier@seed.yamba.dev", "Linh", "Nguyễn"),
  josephine: voyageur("josephine", "josephine.carrier@seed.yamba.dev", "Joséphine", "Ilunga"),

  // Les six Expéditeurs — aucun profil Voyageur.
  aminata: expediteur("aminata", "aminata.shipper@seed.yamba.dev", "Aminata", "Diallo"),
  pauline: expediteur("pauline", "pauline.shipper@seed.yamba.dev", "Pauline", "Lemaire"),
  joao: expediteur("joao", "joao.shipper@seed.yamba.dev", "João", "Santos"),
  chinwe: expediteur("chinwe", "chinwe.shipper@seed.yamba.dev", "Chinwe", "Eze"),
  mai: expediteur("mai", "mai.shipper@seed.yamba.dev", "Mai", "Trần"),
  marieclaire: expediteur("marieclaire", "marieclaire.shipper@seed.yamba.dev", "Marie-Claire", "Bouchard"),
} as const satisfies Record<string, Compte>;

export type CleCompte = keyof typeof COMPTES;

/* ══ Les comptes du back-office (RECETTE-02-ADMIN § 2.5) ══════════════════════════════════════
 * Créés comme des membres ordinaires puis promus — c'est `seed-admins.ts` qui le fait, avec
 * l'écriture exacte de `grant-admin.ts`, et qui enrôle leur double authentification : le
 * secret TOTP de chacun est écrit dans `seed-admins-output.json` (jamais versionné) et le
 * harnais CALCULE le code à six chiffres avec `packages/libs/totp`, comme la campagne API.
 * Même mot de passe que les membres du seed. */

export type ProfilAdmin = "SUPER_ADMIN" | "MEDIATOR" | "SUPPORT" | "FINANCE" | "OPS" | "PRIVACY";

export interface CompteAdmin {
  cle: string;
  email: string;
  prenom: string;
  nom: string;
  profils: readonly ProfilAdmin[];
}

const admin = (cle: string, email: string, prenom: string, nom: string, ...profils: ProfilAdmin[]): CompteAdmin => ({ cle, email, prenom, nom, profils });

export const COMPTES_ADMIN = {
  super: admin("super", "super@recette.yamba.dev", "Sacha", "Superviseur", "SUPER_ADMIN"),
  mediateur: admin("mediateur", "mediateur@recette.yamba.dev", "Nadia", "Médiatrice", "MEDIATOR"),
  support: admin("support", "support@recette.yamba.dev", "Sami", "Support", "SUPPORT"),
  exploitation: admin("exploitation", "exploitation@recette.yamba.dev", "Olivier", "Exploitation", "OPS"),
  finance: admin("finance", "finance@recette.yamba.dev", "Fatou", "Finance", "FINANCE"),
  privacy: admin("privacy", "privacy@recette.yamba.dev", "Paul", "Privacy", "PRIVACY"),
  /** Profils cumulés = UNION des permissions (D60 1A) — scénario ADM-PRM-7. */
  cumul: admin("cumul", "cumul@recette.yamba.dev", "Camille", "Cumul", "SUPPORT", "FINANCE"),
} as const satisfies Record<string, CompteAdmin>;

export type CleCompteAdmin = keyof typeof COMPTES_ADMIN;
