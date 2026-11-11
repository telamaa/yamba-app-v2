/**
 * register-flow-state.ts — le mot de passe du parcours d'inscription,
 * le temps d'un parcours (D92 3A).
 * ====================================================================
 * Le serveur n'ouvre PAS de session à la vérification du code : il active le
 * compte, c'est tout. Le site poussait donc vers `/login?verified=1` — et son
 * titre, « Plus qu'une étape ! », promettait une étape en en livrant deux.
 * Le téléphone, lui, rejoue la connexion avec le mot de passe encore en
 * mémoire du parcours (A208) : chez lui la promesse était vraie, et c'est lui
 * qui ne la faisait pas. D92 aligne la MÉCANIQUE, pas les mots.
 *
 * OÙ VIT CE MOT DE PASSE, ET POURQUOI PAS AILLEURS :
 *   • ici, dans une variable de MODULE — elle vit dans l'onglet, meurt avec
 *     lui, n'est jamais sérialisée, jamais lisible par une autre page, jamais
 *     présente dans un dump de stockage. `/register` → `/register/verify` est
 *     une navigation CLIENT (`router.push`) : le module n'est pas rechargé,
 *     la valeur traverse. C'est l'exact équivalent de `auth-flow-state` côté
 *     mobile ;
 *   • PAS dans un stockage du navigateur — ni celui de l'onglet, ni celui
 *     du domaine : un mot de passe en clair qui survit à un rechargement, et
 *     que n'importe quel script de la page peut relire, est un abaissement
 *     de sécurité que le confort d'un enchaînement ne justifie pas ;
 *   • PAS dans l'URL, pour les raisons déjà écrites dans `RegisterForm`
 *     (journaux serveur, historique, `Referer`).
 *
 * CONSÉQUENCE ASSUMÉE : un RECHARGEMENT de la page de vérification perd le
 * mot de passe. Ce n'est pas un défaut, c'est la contrepartie du choix
 * ci-dessus — et le repli est déjà écrit : la connexion préremplie, bandeau
 * « compte activé ». Exactement le repli du mobile.
 *
 * CQS (règle du dépôt, D88) : `readPendingPassword` RÉPOND et n'écrit pas ;
 * `clearPendingPassword` ÉCRIT et ne répond pas. Une lecture qui effacerait
 * en répondant serait appelable depuis un rendu sans que rien ne le dise.
 */

type PendingPassword = { email: string; password: string };

let pending: PendingPassword | null = null;

/** Appelé à la création du pending d'inscription, jamais ailleurs. */
export function setPendingPassword(email: string, password: string): void {
  pending = { email, password };
}

/**
 * Le mot de passe du parcours SI c'est bien la même adresse — une adresse
 * qui a changé en route (« Modifier ») ne doit pas rejouer l'ancienne.
 * Retourne `null` dès que le moindre doute existe.
 */
export function readPendingPassword(email: string): string | null {
  if (pending === null) return null;
  if (pending.email !== email) return null;
  return pending.password;
}

/** À appeler dès que le parcours se termine — succès comme abandon. */
export function clearPendingPassword(): void {
  pending = null;
}
