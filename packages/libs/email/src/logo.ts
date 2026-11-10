/**
 * logo.ts — le symbole Yamba, EMBARQUÉ dans le bundle (D94).
 * ==========================================================
 * `apps/user-ui/public/brand/yamba-email-logo-color.png`, encodé une fois
 * pour toutes : le symbole « Porter » dans ses couleurs, pour le bandeau blanc.
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
 * 6,2 Ko bruts → 8 488 caractères base64, payés une fois par email.
 */

/** L'identifiant référencé par `<img src="cid:…">` dans le gabarit. */
export const LOGO_CID = "yamba-symbol";

/**
 * Le PNG, 256×256, fond BLANC, symbole EN COULEURS (Y mangue, colis teal).
 *
 * Revue du 10/11 : « tu n'as pas mis le mail aux couleurs Yamba ». Le bandeau
 * était un aplat teal et le symbole y était servi en blanc — l'email entier
 * ne portait donc qu'UNE couleur sur les deux, et pas la principale. Le
 * symbole reprend ses couleurs, et le bandeau passe au blanc pour qu'il
 * puisse les porter : c'est la palette du SITE (en-tête blanc, logo mangue),
 * et un email doit ressembler au site d'où il vient.
 *
 * Fond blanc et non transparent : l'alpha d'un PNG est rendu de façon
 * inégale par Outlook, et le bandeau est blanc de toute façon.
 */
export const LOGO_PNG_BASE64 =
  "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" +
  "BYA5QAKGCfw/kxKEO5BTr3IAAAAASUVORK5CYII=";
