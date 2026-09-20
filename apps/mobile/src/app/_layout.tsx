import { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AppSplash } from '@/components/app-splash';
import { Brand } from '@/constants/theme';
import { AppIntlProvider } from '@/i18n/provider';
import { SessionProvider, useSession } from '@/lib/session-context';
import { isWelcomeDismissed } from '@/lib/welcome-state';

// L'ouverture (lot bienvenue) : le splash JS prolonge le splash natif tant
// que la session AMORCE (un vrai temps de chargement, jamais un délai
// artificiel) ; l'amorçage rend son verdict UNE fois — anonyme et pas encore
// passé → l'écran de bienvenue ; connecté ou déjà passé → les onglets.
function LaunchGate() {
  const { status } = useSession();
  const decided = useRef(false);

  useEffect(() => {
    if (status === 'loading' || decided.current) return;
    decided.current = true;
    if (status === 'anonymous' && !isWelcomeDismissed()) {
      router.replace('/welcome');
    }
  }, [status]);

  return status === 'loading' ? <AppSplash /> : null;
}

// La pile racine : le groupe d'onglets, et la connexion par-dessus en modale
// (idiomatique iOS ; sur Android, une feuille pleine page). La session vit au
// niveau racine : les onglets, la porte d'identité et les badges la partagent.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: Brand.mango } };

  return (
    <AppIntlProvider>
      <SessionProvider>
        <ThemeProvider value={theme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            {/* La fiche trajet se pousse PAR-DESSUS les onglets (pas dedans) :
                le retour ramène aux résultats, la barre reste celle du groupe. */}
            <Stack.Screen name="trip/[id]" />
          </Stack>
          {/* Après la pile : le splash peint PAR-DESSUS pendant l'amorçage. */}
          <LaunchGate />
        </ThemeProvider>
      </SessionProvider>
    </AppIntlProvider>
  );
}
