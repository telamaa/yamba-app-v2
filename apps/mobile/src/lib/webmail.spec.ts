/**
 * webmail.spec.ts — « Ouvrir ma boîte mail », et ce qu'il ne doit JAMAIS faire.
 * =============================================================================
 * La règle est courte, ce qui la rend facile à « améliorer » dans le mauvais
 * sens. Les deux dérives que ces fiches interdisent :
 *
 *   • DEVINER. Un `https://webmail.<domaine>` pour un domaine inconnu
 *     enverrait vers une page morte — pire que de ne rien proposer, parce
 *     qu'on aurait fait sortir l'utilisateur du tunnel pour rien ;
 *   • ACCEPTER n'importe quoi. L'adresse vient d'un champ de saisie : elle
 *     peut être vide, à moitié tapée, ou contenir deux `@`.
 */
import { webmailUrl } from './webmail';

describe('les domaines connus rendent leur webmail', () => {
  it.each([
    ['marie@gmail.com', 'https://mail.google.com'],
    ['marie@googlemail.com', 'https://mail.google.com'],
    ['marie@outlook.com', 'https://outlook.live.com/mail'],
    ['marie@hotmail.fr', 'https://outlook.live.com/mail'],
    ['marie@yahoo.fr', 'https://mail.yahoo.com'],
    ['marie@icloud.com', 'https://www.icloud.com/mail'],
    ['marie@proton.me', 'https://mail.proton.me'],
    ['marie@orange.fr', 'https://mail.orange.fr'],
    ['marie@free.fr', 'https://zimbra.free.fr'],
    ['marie@laposte.net', 'https://www.laposte.net/accueil'],
  ])('%s → %s', (email, attendu) => {
    expect(webmailUrl(email)).toBe(attendu);
  });

  it('la casse de ce qui a été TAPÉ ne décide de rien', () => {
    // Un clavier de téléphone met volontiers une capitale au premier
    // caractère : ce n'est pas une raison pour refuser le geste.
    expect(webmailUrl('Marie@Gmail.COM')).toBe('https://mail.google.com');
  });

  it('les espaces de tête et de queue sont tolérés', () => {
    expect(webmailUrl('  marie@gmail.com  ')).toBe('https://mail.google.com');
  });
});

describe('un domaine inconnu ne rend RIEN — le bouton ne s’affiche pas', () => {
  it.each([
    'marie@yamba.app',
    'marie@mon-entreprise.fr',
    'marie@gmail.co', // la faute de frappe que l'écran sert justement à voir
  ])('%s', (email) => {
    expect(webmailUrl(email)).toBeNull();
  });

  it('aucune adresse devinée : le domaine n’apparaît jamais dans la sortie', () => {
    // Le piège serait de « construire » https://webmail.<domaine>. La fiche
    // le dit autrement : si le domaine inconnu ressortait, la sortie ne
    // serait pas nulle.
    expect(webmailUrl('marie@domaine-qui-nexiste-pas.test')).toBeNull();
  });
});

describe('ce qui n’est pas une adresse ne rend RIEN', () => {
  it.each([
    ['vide', ''],
    ['espaces seuls', '   '],
    ['sans arobase', 'mariegmail.com'],
    ['arobase en tête', '@gmail.com'],
    ['arobase en queue', 'marie@'],
    ['deux arobases', 'marie@perso@gmail.com'],
  ])('%s', (_cas, email) => {
    expect(webmailUrl(email)).toBeNull();
  });
});
