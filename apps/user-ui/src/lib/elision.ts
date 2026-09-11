/**
 * elision.ts — « de Pauline » mais « d'Aminata », « que Pauline » mais « qu'Aminata »
 * ==================================================================================
 * ANO-WEB-49 (recette 5.16) : les textes de la prise en charge écrivaient l'élision dans le message
 * (« Ce qu''{prénom} a déclaré », « la déclaration d''{prénom} ») — juste devant Aminata, faux devant
 * Pauline (« qu'Pauline », « d'Pauline »). ICU ne sait pas élider : le composant calcule le mot élidé
 * et le passe au message (`{queShipper}`, `{deShipper}`). Règle : élision devant une voyelle (accents
 * compris) ou un h (muet par défaut — le h aspiré est rare dans un prénom) ; sinon le mot entier.
 */
const VOYELLE_OU_H = /^[aeiouyàâäéèêëîïôöùûüÿæœh]/i;

export function elider(mot: "de" | "que" | "le" | "la", nom: string): string {
  const n = (nom ?? "").trim();
  if (!n) return mot;
  const elide = VOYELLE_OU_H.test(n);
  if (mot === "le" || mot === "la") return elide ? `l'${n}` : `${mot} ${n}`;
  return elide ? `${mot.slice(0, -1)}'${n}` : `${mot} ${n}`;
}
