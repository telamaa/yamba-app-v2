/**
 * webmail.ts — « Ouvrir ma boîte mail », et la seule façon honnête de le faire (D92 1A).
 * =====================================================================================
 * L'écran de vérification est le seul du produit où l'utilisateur SORT de
 * l'application : il va chercher un code dans sa boîte mail. Lui offrir le
 * geste qu'il s'apprête à faire à la main est la seule aide réelle que cet
 * écran puisse donner.
 *
 * Pourquoi une adresse `https://` et pas le schéma de l'application native
 * (`googlegmail://`, `message://`) — l'arbitrage, pour ne pas le repayer :
 *   • un schéma d'app doit être DÉCLARÉ (`LSApplicationQueriesSchemes` sur
 *     iOS) avant de pouvoir seulement être testé, et il échoue en silence
 *     quand l'app n'est pas installée ;
 *   • `message://` n'ouvre QUE Mail d'Apple — inutile à qui lit son courrier
 *     dans Gmail, c'est-à-dire la majorité ;
 *   • une adresse web s'ouvre partout, et les webmails redirigent eux-mêmes
 *     vers leur application quand elle est installée.
 * On perd l'ouverture « native » d'un cran ; on gagne un comportement
 * identique sur les deux systèmes, les deux fronts, et zéro configuration.
 *
 * RÈGLE : un domaine inconnu ne rend RIEN (`null`), et le bouton ne
 * s'affiche pas. Deviner (« https://webmail.<domaine> ») enverrait vers une
 * page morte, ce qui est pire que de ne rien proposer.
 *
 * Jumeau web : `apps/user-ui/src/lib/auth/webmail.ts` — même table, mêmes
 * cas. La recopie est assumée (les deux fronts ne partagent pas de paquet
 * d'interface) ; c'est la divergence des deux `maskEmail`, restée invisible
 * des mois, qui a justement motivé D92 2A.
 */

/** Domaine (en minuscules, sans le `@`) → page d'accueil du webmail. */
const WEBMAILS: Record<string, string> = {
  // Google
  'gmail.com': 'https://mail.google.com',
  'googlemail.com': 'https://mail.google.com',
  // Microsoft
  'outlook.com': 'https://outlook.live.com/mail',
  'outlook.fr': 'https://outlook.live.com/mail',
  'hotmail.com': 'https://outlook.live.com/mail',
  'hotmail.fr': 'https://outlook.live.com/mail',
  'live.com': 'https://outlook.live.com/mail',
  'live.fr': 'https://outlook.live.com/mail',
  'msn.com': 'https://outlook.live.com/mail',
  // Yahoo
  'yahoo.com': 'https://mail.yahoo.com',
  'yahoo.fr': 'https://mail.yahoo.com',
  'ymail.com': 'https://mail.yahoo.com',
  // Apple
  'icloud.com': 'https://www.icloud.com/mail',
  'me.com': 'https://www.icloud.com/mail',
  'mac.com': 'https://www.icloud.com/mail',
  // Proton
  'proton.me': 'https://mail.proton.me',
  'protonmail.com': 'https://mail.proton.me',
  'pm.me': 'https://mail.proton.me',
  // Fournisseurs français (le corridor France ↔ Afrique centrale est le
  // premier de Yamba : ces quatre-là pèsent lourd dans la diaspora)
  'orange.fr': 'https://mail.orange.fr',
  'wanadoo.fr': 'https://mail.orange.fr',
  'free.fr': 'https://zimbra.free.fr',
  'sfr.fr': 'https://webmail.sfr.fr',
  'laposte.net': 'https://www.laposte.net/accueil',
  // Allemagne / international
  'gmx.com': 'https://www.gmx.com',
  'gmx.net': 'https://www.gmx.net',
  'web.de': 'https://web.de',
  'zoho.com': 'https://mail.zoho.com',
  'aol.com': 'https://mail.aol.com',
};

/**
 * `marie@gmail.com` → `https://mail.google.com`, `marie@yamba.app` → `null`.
 *
 * Tolère l'espace de tête ou de queue et la casse (ce que l'utilisateur a
 * tapé, pas ce que l'on espérait) ; refuse tout ce qui n'a pas exactement un
 * `@` entouré de deux parties non vides.
 */
export function webmailUrl(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  if (trimmed.indexOf('@') !== at) return null;
  const domain = trimmed.slice(at + 1).toLowerCase();
  return WEBMAILS[domain] ?? null;
}
