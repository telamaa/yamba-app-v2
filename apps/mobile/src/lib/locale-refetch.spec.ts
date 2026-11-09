/**
 * locale-refetch.spec.ts — la langue change, le serveur est redemandé.
 * =====================================================================
 * Défaut mesuré sur ÉMULATEUR ANDROID le 09/11/2026, et c'est là tout son
 * intérêt : il ne se voit qu'au moment précis où la langue bascule sous une
 * liste déjà chargée — une connexion. Personne ne refait ce geste en recette
 * courante, et aucun des dix-neuf contrôles de la CI ne le ferait non plus :
 * `tsc` type parfaitement une date venue du serveur, le contrôle i18n compare
 * FR et EN entre EUX (la chaîne fautive n'est dans aucun dictionnaire, elle
 * vient de `trip-mappers.ts`), et le harnais ne rend aucun écran.
 *
 * Les fiches ci-dessous épinglent donc les quatre moments de la vie de
 * l'écran, et les deux ALLERS-RETOURS QU'IL NE FAUT PAS FAIRE — parce qu'une
 * règle de rafraîchissement trop zélée coûte un appel serveur à chaque
 * ouverture, et que ce coût-là ne se voit pas non plus.
 */
import { shouldRefetchForLocale } from '@/lib/locale-refetch';

describe('shouldRefetchForLocale — redemander, mais seulement quand il le faut', () => {
  it('① la langue a changé sous une liste affichée : on redemande', () => {
    expect(
      shouldRefetchForLocale({ served: 'en', current: 'fr', state: 'served' })
    ).toBe(true);
  });

  it('② même langue : jamais — c’est le cas de 99,9 % des rendus', () => {
    expect(
      shouldRefetchForLocale({ served: 'fr', current: 'fr', state: 'served' })
    ).toBe(false);
  });

  it('③ au MONTAGE (servie = celle de l’écran) : aucun aller-retour de plus', () => {
    // L'appelant initialise la mémoire à la langue du montage : c'est
    // exactement la fiche ② vue depuis l'écran, et c'est ce qui empêche la
    // règle de coûter un appel à chaque ouverture d'onglet.
    const auMontage = 'fr';
    expect(
      shouldRefetchForLocale({ served: auMontage, current: auMontage, state: 'idle' })
    ).toBe(false);
  });

  it('④ écran encore VIDE : on ne redemande rien, la prochaine demande portera la bonne langue', () => {
    expect(
      shouldRefetchForLocale({ served: 'en', current: 'fr', state: 'idle' })
    ).toBe(false);
  });

  it('⑤ requête EN VOL : on redemande — elle est partie avec l’ancien en-tête', () => {
    // Le piège : « pending » ressemble à « vide », et il n'en est pas un. La
    // réponse qui arrive remplirait l'écran dans la langue d'AVANT, sans que
    // rien ne vienne ensuite la corriger.
    expect(
      shouldRefetchForLocale({ served: 'en', current: 'fr', state: 'pending' })
    ).toBe(true);
  });

  it('⑥ une panne affichée compte comme du contenu servi', () => {
    // Un message d'erreur est LUI AUSSI dans une langue. L'écran le traduit
    // tout seul (il vient de `t`), mais le rappel relance la recherche, ce
    // qui est le bon geste après un changement de langue.
    expect(
      shouldRefetchForLocale({ served: 'fr', current: 'en', state: 'pending' })
    ).toBe(true);
  });

  it('⑦ aller-retour de langue : chaque bascule compte, aucune ne s’annule', () => {
    expect(shouldRefetchForLocale({ served: 'fr', current: 'en', state: 'served' })).toBe(true);
    expect(shouldRefetchForLocale({ served: 'en', current: 'fr', state: 'served' })).toBe(true);
  });
});

describe('le défaut d’origine, raconté par la fonction', () => {
  it('visiteur en anglais → connexion d’un compte français : la page est redemandée', () => {
    // Le parcours exact de la capture du 09/11 : appareil en-US, flux chargé,
    // puis `preferredLocale: "fr"` arrive avec la session (D44).
    const avant = { served: 'en', current: 'en', state: 'served' as const };
    expect(shouldRefetchForLocale(avant)).toBe(false);

    const apresConnexion = { ...avant, current: 'fr' };
    expect(shouldRefetchForLocale(apresConnexion)).toBe(true);
  });

  it('déconnexion : on retombe sur la langue de l’appareil, même rappel', () => {
    expect(
      shouldRefetchForLocale({ served: 'fr', current: 'en', state: 'served' })
    ).toBe(true);
  });
});
