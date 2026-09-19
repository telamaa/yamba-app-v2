/**
 * session-context.tsx — la session partagée par les onglets (lot tabs D36).
 * =========================================================================
 * Avant les onglets, l'écran d'accueil amorçait la session pour lui seul.
 * Avec cinq onglets dont trois derrière la porte d'identité, l'état de
 * session devient partagé : UN amorçage au démarrage (refresh en réserve →
 * /auth/me), un seul état lu par la porte, les badges et l'écran Profil.
 * Le serveur reste seul juge (RG-MOB-1) : `user` est ce que /auth/me a
 * répondu, jamais une déduction locale.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { usePreferredLocaleSetter } from '@/i18n/provider';
import {
  bootstrapSession,
  login,
  logout,
  me,
  type SessionUser,
} from '@/lib/api/auth.api';

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

type SessionState = {
  status: SessionStatus;
  user: SessionUser | null;
  /** Connexion : jette l'ApiError du serveur telle quelle (l'écran traduit). */
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession() appelé hors de <SessionProvider>');
  }
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const setPreferredLocale = usePreferredLocaleSetter();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasSession = await bootstrapSession();
      const sessionUser = hasSession ? await me().catch(() => null) : null;
      if (!cancelled) {
        setUser(sessionUser);
        setPreferredLocale(sessionUser?.preferredLocale ?? null);
        setStatus(sessionUser !== null ? 'authenticated' : 'anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setPreferredLocale]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const sessionUser = await login(email, password);
      setUser(sessionUser);
      setPreferredLocale(sessionUser.preferredLocale ?? null);
      setStatus('authenticated');
      return sessionUser;
    },
    [setPreferredLocale]
  );

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setPreferredLocale(null);
    setStatus('anonymous');
  }, [setPreferredLocale]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
