/**
 * regles-de-navigation.spec.ts — tunnels et redirections (A224).
 * ===============================================================
 * Deux règles que rien ne gardait côté site, et qui décident l'une de ce que
 * voit un membre en train de payer, l'autre de l'endroit où il atterrit après
 * s'être connecté. La seconde est un garde-fou de SÉCURITÉ (« open
 * redirect ») : c'est le genre de code qui ne casse jamais en développement
 * et qui se découvre en production.
 */
import { sanitizeRedirect, withRedirect } from '@/lib/auth/safe-redirect';
import {
  AUTH_TUNNEL_PREFIXES,
  isAuthTunnel,
  isCheckoutTunnel,
  tunnelModeFor,
} from '@/lib/layout/tunnel';

describe('D93 — le régime de navigation est une donnée de la route', () => {
  it('les six pages d’auth sont en régime `auth`', () => {
    for (const prefixe of AUTH_TUNNEL_PREFIXES) {
      expect(tunnelModeFor(prefixe)).toBe('auth');
      expect(tunnelModeFor(prefixe + '/verify')).toBe('auth');
    }
  });

  it('`/refresh` en fait partie — c’est l’oubli qui a coûté 27 jours', () => {
    // La liste vivait en DOUBLE (`NO_REDIRECT_PREFIXES` dans
    // `login-redirect.ts`) et les deux copies avaient divergé sur ce chemin.
    expect([...AUTH_TUNNEL_PREFIXES]).toContain('/refresh');
    expect(isAuthTunnel('/refresh')).toBe(true);
  });

  it('un préfixe ne déborde pas sur un chemin qui commence pareil', () => {
    // `/loginsomething` n'est pas une page d'auth : le test est « lui-même ou
    // un de ses enfants », jamais un `startsWith` nu.
    expect(isAuthTunnel('/loginatorium')).toBe(false);
    expect(isAuthTunnel('/registry')).toBe(false);
    expect(isAuthTunnel('/login/step-2')).toBe(true);
  });

  it('seule l’étape de PAIEMENT est en régime `checkout`', () => {
    expect(isCheckoutTunnel('/trips/abc123/book')).toBe(true);
    expect(isCheckoutTunnel('/trips/abc123/book/')).toBe(true);
    // On compare encore sur la page du trajet : on n'y est pas engagé.
    expect(isCheckoutTunnel('/trips/abc123')).toBe(false);
    expect(tunnelModeFor('/trips/abc123')).toBe('none');
  });

  it('le reste du site n’est sous aucun tunnel', () => {
    for (const chemin of ['/', '/search', '/dashboard', '/u/marven']) {
      expect(tunnelModeFor(chemin)).toBe('none');
    }
  });

  it('un chemin absent ne plante pas et ne ferme rien', () => {
    // La règle est appelée depuis un composant qui peut rendre avant que le
    // routeur ait un chemin : `null` doit valoir « pas de tunnel ».
    expect(tunnelModeFor(null)).toBe('none');
    expect(tunnelModeFor(undefined)).toBe('none');
    expect(isAuthTunnel('')).toBe(false);
  });
});

describe('garde-fou anti « open redirect »', () => {
  it('accepte un chemin interne', () => {
    expect(sanitizeRedirect('/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirect('/trips/abc?from=x')).toBe('/trips/abc?from=x');
  });

  it('refuse tout ce qui emmène AILLEURS', () => {
    // `//evil.com` est l'attaque classique : le navigateur le lit comme un
    // hôte, pas comme un chemin.
    for (const hostile of [
      '//evil.com',
      'https://evil.com',
      'http://evil.com',
      'javascript://evil',
      '//evil.com/login',
    ]) {
      expect(sanitizeRedirect(hostile)).toBeNull();
    }
  });

  it('refuse ce qui n’est pas un chemin', () => {
    expect(sanitizeRedirect('dashboard')).toBeNull();
    expect(sanitizeRedirect('')).toBeNull();
    expect(sanitizeRedirect(null)).toBeNull();
    expect(sanitizeRedirect(undefined)).toBeNull();
  });

  it('ignore les espaces autour, qui ne changent pas l’intention', () => {
    expect(sanitizeRedirect('  /dashboard  ')).toBe('/dashboard');
    expect(sanitizeRedirect('   ')).toBeNull();
  });

  it('withRedirect encode la destination et respecte la requête existante', () => {
    expect(withRedirect('/login', null)).toBe('/login');
    expect(withRedirect('/login', '/trips/a?b=c')).toBe(
      '/login?redirect=' + encodeURIComponent('/trips/a?b=c')
    );
    expect(withRedirect('/login?x=1', '/d')).toBe('/login?x=1&redirect=%2Fd');
  });
});
