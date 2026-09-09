/**
 * session-marker.ts — une session qui n'a jamais existé ne peut pas expirer (ANO-WEB-01)
 * ======================================================================================
 * Recette navigateur du 09/09/2026, cahier 01-WEB, chapitre 5.3. Un visiteur qui ouvre
 * `/fr/login` **sans avoir jamais eu de session** recevait la fenêtre modale « Ta session a
 * expiré », posée par-dessus l'écran de connexion — et son fond opaque **bloquait le
 * formulaire** : impossible de cliquer « Se connecter » sans fermer d'abord une fenêtre qui
 * n'avait aucune raison d'être là.
 *
 * La cause est en amont de la fenêtre : `api-client` traite tout 401 suivi d'un
 * rafraîchissement raté comme une *expiration*. Pour un visiteur, c'est faux : il n'y avait
 * rien à expirer. Il manquait la seule information qui distingue les deux cas — **ce
 * navigateur a-t-il déjà eu une session ?**
 *
 * Le marqueur vit dans `localStorage`, sans aucune donnée personnelle : une valeur `"1"`, rien
 * d'autre. Il est posé quand une requête authentifiée **réussit** (preuve qu'une session
 * existe), et retiré à la déconnexion comme à l'expiration. Toute lecture ou écriture est
 * protégée : navigation privée, stockage refusé, quota plein — le marqueur absent fait
 * simplement retomber sur « aucune session connue », qui est le comportement prudent (pas de
 * fenêtre plutôt qu'une fenêtre injustifiée).
 */
"use client";

const CLE = "yamba:session";

/** Une requête authentifiée a réussi : ce navigateur a bien une session. */
export function marquerSessionActive(): void {
  try {
    window.localStorage.setItem(CLE, "1");
  } catch {
    /* stockage indisponible : on s'en passe, cf. en-tête */
  }
}

/** Déconnexion, ou session définitivement perdue. */
export function oublierSession(): void {
  try {
    window.localStorage.removeItem(CLE);
  } catch {
    /* idem */
  }
}

/** Ce navigateur a-t-il déjà porté une session ? Faux par défaut. */
export function aEuUneSession(): boolean {
  try {
    return window.localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}
