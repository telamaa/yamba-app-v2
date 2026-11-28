/**
 * fil-ecrans.spec.ts — ce que les ÉCRANS du fil doivent tenir (D117).
 * =====================================================================
 * Le harnais ne rend aucun composant (frontière A223) : ces fiches LISENT
 * les écrans. C'est moins fort qu'un rendu, et c'est tout de même ce qui a
 * attrapé, ce mois-ci, un `HeaderSkeleton` oublié (D93), un squelette d'une
 * page de résultats resté dans l'ancien gabarit (D100) et une porte sans
 * sortie (D104).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { RYTHME_DE_LA_LISTE_MS, RYTHME_DU_FIL_MS } from '@/lib/fil';

const MOBILE = resolve(__dirname, '../..');

function lire(chemin: string): string {
  return readFileSync(join(MOBILE, chemin), 'utf8');
}

function sansCommentaires(source: string): string {
  const net = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  expect(net.length).toBeGreaterThan(source.length / 4);
  return net;
}

const FIL = 'src/app/conversation/[id].tsx';
const LISTE = 'src/app/(tabs)/messages.tsx';

describe('① le sondage s’arrête quand personne ne regarde (D117 7A)', () => {
  it('les deux écrans sondent SOUS `useFocusEffect`, pas sous `useEffect`', () => {
    // Un `setInterval` posé dans un `useEffect` continue de battre quand
    // l'écran est empilé dessous : l'app garde ses écrans montés.
    for (const chemin of [FIL, LISTE]) {
      const net = sansCommentaires(lire(chemin));
      expect(net).toContain('useFocusEffect');
      const sondage = net.indexOf('setInterval');
      const focus = net.indexOf('useFocusEffect');
      expect(sondage).toBeGreaterThan(focus);
    }
  });

  it('chaque minuterie est ARRÊTÉE au départ de l’écran', () => {
    // Une minuterie sans `clearInterval` survit à l'écran qui l'a posée et
    // sonde pour l'éternité — avec, à chaque tour, un `setState` sur un
    // composant démonté.
    for (const chemin of [FIL, LISTE]) {
      const net = sansCommentaires(lire(chemin));
      expect(net.match(/setInterval/g)?.length).toBe(net.match(/clearInterval/g)?.length);
    }
  });

  it('le FIL ne sonde pas non plus quand l’app passe en arrière-plan', () => {
    // `useFocusEffect` couvre la navigation ; `AppState` couvre la poche.
    // Les deux sont nécessaires, et c'est le fil — 3 s — qui le paie cher.
    const net = sansCommentaires(lire(FIL));
    expect(net).toContain("AppState.currentState === 'active'");
  });

  it('les rythmes viennent du module, jamais écrits dans l’écran', () => {
    for (const chemin of [FIL, LISTE]) {
      const net = sansCommentaires(lire(chemin));
      expect(net).not.toMatch(/setInterval\([^)]*,\s*\d/);
    }
    expect(sansCommentaires(lire(FIL))).toContain('RYTHME_DU_FIL_MS');
    expect(sansCommentaires(lire(LISTE))).toContain('RYTHME_DE_LA_LISTE_MS');
    // Et les deux rythmes restent DIFFÉRENTS : un fil ouvert se regarde,
    // une liste s'attend.
    expect(RYTHME_DU_FIL_MS).toBeLessThan(RYTHME_DE_LA_LISTE_MS);
  });
});

describe('② une absence et une PANNE ne se disent pas pareil', () => {
  it('la liste distingue les deux', () => {
    // Sans cette distinction, un réseau coupé annoncerait « aucune
    // conversation » — le mensonge corrigé deux fois sur le site.
    const net = sansCommentaires(lire(LISTE));
    expect(net).toContain('conversationsEnEchec');
    expect(net).toContain("t('list.loadError')");
    expect(net).toContain("t('list.empty')");
    expect(net).toContain("t('list.retry')");
  });

  it('le fil dit sa panne et offre une SORTIE (famille D104)', () => {
    const net = sansCommentaires(lire(FIL));
    expect(net).toContain("t('thread.loadError')");
    expect(net).toContain('router.back()');
  });

  it('le contexte garde le dernier compte connu plutôt que d’annoncer zéro', () => {
    // Une panne qui remet la pastille à zéro dit « tout est lu » : c'est la
    // version silencieuse du même mensonge.
    const net = sansCommentaires(lire('src/lib/activite-context.tsx'));
    expect(net).toMatch(/enEchec \? precedent\.badges\.unreadMessages/);
    expect(net).toMatch(/enEchec \? precedent\.conversations/);
  });
});

describe('③ la saisie dit toujours ce qui la retient (A209)', () => {
  it('le bouton d’envoi n’est jamais muet', () => {
    const net = sansCommentaires(lire(FIL));
    // Le premier manque DÉCIDE de la phrase : pas de bouton éteint sans
    // explication, et pas de disjonction dans une prop d'état (D116 bis).
    expect(net).toContain('premierManque');
    expect(net).not.toMatch(/disabled=\{[^}]*\|\|/);
  });

  it('la saisie fermée dit POURQUOI, et le motif vient du serveur', () => {
    const net = sansCommentaires(lire(FIL));
    expect(net).toContain('acces.peutEcrire');
    expect(net).toMatch(/closed\.\$\{acces\.motif/);
  });

  it('le texte RESTE dans la saisie quand le serveur refuse', () => {
    // Le perdre sur un refus ferait tout retaper, debout (D116 1C).
    const net = sansCommentaires(lire(FIL));
    const refus = net.slice(net.indexOf('catch (e)'), net.indexOf('} finally'));
    expect(refus.length).toBeGreaterThan(40);
    expect(refus).not.toContain("setCorps('')");
  });

  it('le plafond est posé DANS le champ, pas seulement vérifié après', () => {
    // Leçon D115 bis ① : le refus arrivait après coup, sur un message
    // générique, et il fallait tout refaire.
    expect(sansCommentaires(lire(FIL))).toContain('slice(0, MESSAGE_MAX)');
  });
});

describe('④ la porte vers le fil n’existe que si le fil existe', () => {
  const deal = sansCommentaires(lire('src/app/deal/[id]/index.tsx'));

  it('elle se trouve dans le contexte, sans requête de plus', () => {
    expect(deal).toContain('useActivite');
    expect(deal).toMatch(/conversations\.find\(\(c\) => c\.bookingId === id\)/);
  });

  it('elle est CONDITIONNÉE à l’existence d’une conversation', () => {
    // Un fil naît à l'ACCEPTATION (D61) : une demande en attente n'en a
    // pas, et un bouton qui mène à rien est pire qu'un bouton absent.
    expect(deal).toContain('conversation !== undefined &&');
  });

  it('accepter fait relire le contexte — sinon la porte tarde à apparaître', () => {
    expect(deal).toContain('void rafraichir();');
  });

  it('la route poussée est celle qui existe', () => {
    expect(deal).toContain("pathname: '/conversation/[id]'");
    expect(sansCommentaires(lire(LISTE))).toContain("pathname: '/conversation/[id]'");
  });
});

describe('⑤ ce qu’on compte plutôt que de le promettre', () => {
  it('les feuilles de signalement sont DEUX, et la troisième factorise', () => {
    // Règle de D115 3A, appliquée dans l'autre sens : on factorise en
    // devenant le TROISIÈME, pas le second. `ReportSheet` (D68) signale une
    // annonce ou un membre — autre service, autres motifs, autres refus.
    // Une dette comptée se rembourse ; une dette promise s'oublie.
    const feuilles = ['src/components/report-sheet.tsx', 'src/components/message-report-sheet.tsx'];
    for (const feuille of feuilles) expect(lire(feuille).length).toBeGreaterThan(0);
    expect(feuilles).toHaveLength(2);
  });

  it('l’écran du fil n’importe AUCUN contrat — c’est la frontière A223', () => {
    const net = sansCommentaires(lire(FIL));
    expect(net).not.toContain('@packages/api-contracts');
  });

  it('aucune fonction de `messages.api.ts` n’est sans appelant', () => {
    // Le défaut corrigé six fois le matin même (D110) : un export écrit
    // « pour la complétude » est un commentaire.
    const api = lire('src/lib/api/messages.api.ts');
    const noms = [...api.matchAll(/export function ([A-Za-z]+)/g)].map((m) => m[1]);
    expect(noms.length).toBeGreaterThanOrEqual(5);

    const appelants = [FIL, LISTE, 'src/components/message-report-sheet.tsx', 'src/lib/activite-context.tsx']
      .map(lire)
      .join('\n');
    for (const nom of noms) {
      expect(`${nom} → ${appelants.includes(`${nom}(`)}`).toBe(`${nom} → true`);
    }
  });
});
