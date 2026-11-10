/**
 * logo.ts — le symbole Yamba, EMBARQUÉ dans le bundle (D94).
 * ==========================================================
 * `apps/user-ui/public/brand/yamba-email-logo.png`, encodé une fois pour
 * toutes : le symbole « Porter » en blanc, pour le bandeau dégradé.
 *
 * POURQUOI EN BASE64 ET PAS UN CHEMIN DE FICHIER : `layout.ts` est une chaîne
 * TypeScript et non un fichier EJS lu sur le disque, précisément pour
 * fonctionner quel que soit le `cwd` du service (`nx serve` depuis la racine,
 * `node dist/main.js` depuis `apps/<service>`, jest). Une image lue sur le
 * disque réintroduirait la dépendance au `cwd` que ce choix avait supprimée —
 * et elle manquerait dans le bundle webpack, qui ne copie que `src/assets`.
 *
 * POURQUOI UNE PIÈCE JOINTE INLINE (cid) ET PAS UNE ADRESSE DISTANTE :
 *   • une image distante ne s'affiche QUE si le client accepte de la charger,
 *     et l'`alt` ne sert que dans le cas contraire — un logo qui n'apparaît
 *     qu'une fois sur deux est pire que pas de logo ;
 *   • en recette locale, Gmail passe les images par son mandataire, qui ne
 *     peut pas atteindre `http://192.168.x.x:3000` : le logo serait CASSÉ sur
 *     le poste même où on le vérifie ;
 *   • elle ne dépend d'aucun hébergeur qui doit rester debout dans cinq ans.
 *
 * 4,1 Ko bruts → 5652 caractères base64, payés une fois par email.
 */

/** L'identifiant référencé par `<img src="cid:…">` dans le gabarit. */
export const LOGO_CID = "yamba-symbol";

/** Le PNG, 192×200, fond transparent, symbole blanc. */
export const LOGO_PNG_BASE64 =
  "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" +
  "2gOMZGbrzew04I/CPH3XnLuBOWb2vl4d/PTyHmA0Se8FVvkFtAk9AqwArjYz5U4mtmIKgN8/5+p9wFnAEbnz6TB3AquB68ys" +
  "ljuZVIoqgJHCGaO/BE7q8PtoY+oPc6s+H04gFKfYAhgmaSdgLnA68Nbc+STyU+AK4BIzeyp3MjkVXwDDJBlwOPBh4M+BXlus" +
  "dQPwDeAq4AclHN83wgugjvBd4bCw1MhxwEG5c2rRw2GtpWuAu0o6tm+UF0ADJO0S1t6ZEx7GvW8H9p3Coc29Yd2im83s6dxJ" +
  "dbpO24hdIazAdgjw7rB32B94S8IlSzaFtTUfC5/yDwD3dOqKdZ3MC6AikqYAe4ZP4Zj2BR43s4HIcYrgBVAxSVG/XJqZb7MK" +
  "9exUCOca4QXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF" +
  "4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF" +
  "4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF" +
  "4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBeCK5gXgiuYF4IrmBVC9VyO2/duI" +
  "bRfJC6B6z0Zs+7mIbRfJC6B6D0Vs+8GIbRfJC6B63+vStotkuRPoNZJmA+uAKRU3PQDsbWa/qLjdovkeoGJhgF4ZoekrffC7" +
  "riBpF0kvqjp9knbL/b6ca5ikuZJqFQz+mqS5ud+Pc02TtKjNIqhJWpT7fTjXMkmnSNrYwuDfKOmU3Pk71zZJsyVdJmmggYE/" +
  "EP53du68S+CnQROStCtwKnAscAAwK/xpA/AocCtwuZmtz5yqc8451+P+H48YvsNrXBXJAAAAAElFTkSuQmCC";
