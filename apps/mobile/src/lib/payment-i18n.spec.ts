/**
 * payment-i18n.spec.ts — les clés CALCULÉES existent dans les deux langues.
 * =========================================================================
 * Les écrans de paiement (D83) ne demandent presque aucun texte par une clé
 * écrite en clair. Ils la CALCULENT :
 *
 *     t(`methods.${methode}.label`)          // la liste, la carte du choix
 *     t(`methods.flows.${flowOf(methode)}`)  // « ce qui va s'ouvrir »
 *     t(`confirm.errors.${authFailureKey(outcome.reason)}`)
 *
 * C'est voulu — un `switch` sur quatre moyens, recopié sur trois écrans,
 * finit toujours par diverger. Mais cela crée un angle mort que RIEN d'autre
 * ne couvre dans le dépôt :
 *
 *   • `tsc` voit un `string`, jamais une clé : un gabarit se type toujours ;
 *   • `check-i18n-messages.mjs` (la CI) compare FR et EN entre eux — deux
 *     dictionnaires qui ont OUBLIÉ la même clé sont un miroir parfait ;
 *   • le harnais ne rend aucun composant (frontière d'A223), donc personne
 *     n'a jamais appelé `t()` avec ces clés.
 *
 * Une clé absente ne casse pas le bundle : `use-intl` rend le CHEMIN de la
 * clé. L'Expéditeur lit alors « confirm.errors.canceled » à l'endroit où on
 * lui devait « Rien n'a été débité ». Sur l'écran qui porte l'argent, c'est
 * le pire endroit du parcours pour un défaut muet.
 *
 * D'où cette fiche, qui part des fonctions PURES (la vérité du code) et va
 * chercher chaque clé dans les deux fichiers RÉELS. Elle n'a aucune liste à
 * tenir à jour : ajouter un moyen à `PAYMENT_METHODS` ajoute ses clés ici.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PAYMENT_METHODS,
  authFailureKey,
  flowOf,
  hintKey,
  labelKey,
  type MethodFlow,
} from './payment-methods';

const LOCALES = ['fr', 'en'] as const;

/** Le dictionnaire `booking` d'une langue, lu sur le disque. */
function dictionnaire(locale: string): unknown {
  const chemin = resolve(__dirname, `../../messages/${locale}/booking.json`);
  return JSON.parse(readFileSync(chemin, 'utf8')) as unknown;
}

/**
 * La valeur sous `a.b.c`, ou `undefined`. Volontairement écrit à la main : on
 * veut traverser exactement comme `use-intl`, par le POINT, sans traiter la
 * clé comme un chemin de fichier ni tolérer un segment vide.
 */
function valeur(racine: unknown, cle: string): unknown {
  let courant: unknown = racine;
  for (const segment of cle.split('.')) {
    if (typeof courant !== 'object' || courant === null) return undefined;
    courant = (courant as Record<string, unknown>)[segment];
  }
  return courant;
}

/** Toutes les clés que les trois écrans de paiement peuvent demander. */
function clesAttendues(): string[] {
  const cles: string[] = [];

  for (const key of PAYMENT_METHODS) {
    cles.push(labelKey(key), hintKey(key));
  }

  // « Ce qui va s'ouvrir », dit AVANT d'ouvrir (écran de paiement). Les flux
  // ne sont pas récités : on demande à `flowOf` celui de chaque moyen, donc un
  // cinquième moyen au flux inédit amènerait sa clé ici tout seul.
  for (const f of new Set<MethodFlow>(PAYMENT_METHODS.map(flowOf))) {
    cles.push(`methods.flows.${f}`);
  }

  // Les refus d'autorisation. On ne récite pas les trois clés : on les fait
  // produire par la fonction, pour les motifs qu'elle sait vraiment recevoir
  // — y compris les deux qui n'en sont pas (null, motif inconnu du SDK).
  const motifs = ['CANCELED', 'UNAVAILABLE', 'FAILED', 'UN_MOTIF_INCONNU', null, undefined];
  for (const motif of motifs) {
    cles.push(`confirm.errors.${authFailureKey(motif)}`);
    cles.push(`card.errors.${authFailureKey(motif)}`);
  }

  // L'attente, pendant la seconde où l'app semble ne rien faire. Deux clés et
  // deux seulement : `confirm.tsx` choisit par `isWallet`, pas par le flux.
  cles.push('confirm.opening.wallet', 'confirm.opening.redirect');
  cles.push('confirm.retry', 'confirm.retryHint');

  // Le reste de l'écran de choix et de la page carte.
  cles.push('methods.title', 'methods.back', 'methods.cta', 'methods.change', 'methods.none');
  cles.push('card.expired');

  return [...new Set(cles)];
}

describe('les clés calculées des écrans de paiement existent', () => {
  for (const locale of LOCALES) {
    describe(locale, () => {
      const dico = dictionnaire(locale);

      for (const cle of clesAttendues()) {
        it(`« ${cle} » est traduite`, () => {
          const trouvee = valeur(dico, cle);
          expect(typeof trouvee).toBe('string');
          expect(trouvee).not.toBe('');
        });
      }
    });
  }
});

describe('la fiche attrape bien une clé manquante', () => {
  /* Une sonde qui ne sait pas échouer ne garde rien. On vérifie donc que la
     lecture répond `undefined` sur une clé absente — et sur un chemin qui
     TRAVERSE une chaîne, le cas réel d'une clé renommée en objet. */
  it('une clé absente ne rend rien', () => {
    expect(valeur(dictionnaire('fr'), 'confirm.errors.inexistante')).toBeUndefined();
  });

  it('un chemin qui continue sous une chaîne ne rend rien', () => {
    expect(valeur(dictionnaire('fr'), 'methods.title.encore')).toBeUndefined();
  });
});
