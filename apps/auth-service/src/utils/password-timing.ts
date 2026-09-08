/**
 * password-timing.ts — le refus de connexion coûte le même temps, compte ou pas (ANO-API-18)
 * ===========================================================================================
 * Recette API du 08/09/2026, fiche API-SEC-14. La connexion mesurait **168,6 ms** pour une
 * adresse connue contre **20,4 ms** pour une inconnue — distributions totalement disjointes
 * (min 146,7 > max 31,1 sur 20 mesures). N'importe qui pouvait donc savoir, en un appel,
 * si une adresse a un compte Yamba : le corps est identique, le chronomètre parle.
 *
 * La cause est le cas d'école : `if (!user) return` **avant** `bcrypt.compare`. Un compte
 * inexistant ne paie jamais le coût du hachage, un compte existant le paie toujours.
 *
 * Le remède est tout aussi classique : comparer quand même, contre un hachage factice de
 * même coût. Les deux chemins paient alors la même chose, et le temps n'apprend plus rien.
 * Le hachage est calculé au chargement du module — jamais écrit en dur, jamais dérivé d'un
 * secret réel.
 */
import bcrypt from "bcryptjs";

/** Même coût que les hachages réels (`bcrypt.hash(password, 10)`). */
const BCRYPT_COST = 10;

/** Un hachage qu'aucun mot de passe ne satisfera : sa seule fonction est de coûter le prix. */
const DUMMY_HASH = bcrypt.hashSync("yamba::timing-equalizer::never-a-real-password", BCRYPT_COST);

/**
 * Compare le mot de passe au hachage du compte — ou à un leurre si le compte n'existe pas.
 * Renvoie toujours `false` dans ce second cas, après avoir payé le même temps de calcul.
 */
export async function comparePasswordConstantTime(
  password: string,
  passwordHash: string | null | undefined
): Promise<boolean> {
  const hash = passwordHash && passwordHash.length > 0 ? passwordHash : DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  return Boolean(passwordHash) && ok;
}
