import { useEffect, useRef, useState } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { Animated, useColorScheme } from 'react-native';

import { AppSplash } from '@/components/app-splash';
import { Brand } from '@/constants/theme';
import { AppIntlProvider } from '@/i18n/provider';
import { SessionProvider, useSession } from '@/lib/session-context';
import { isWelcomeDismissed } from '@/lib/welcome-state';

// Le splash tient AU MOINS ce temps-là avant de s'effacer en fondu : un
// PLANCHER de rythme (un amorçage éclair flashe comme un bug), jamais un
// plafond — un vrai chargement lent le dépasse naturellement.
const SPLASH_MIN_MS = 1500;
const SPLASH_FADE_MS = 350;

// L'ouverture (lot bienvenue) : le splash JS prolonge le splash natif pendant
// l'amorçage de la session ; l'amorçage rend son verdict UNE fois — anonyme
// et pas encore passé → l'écran de bienvenue ; connecté ou déjà passé → les
// onglets. La redirection part sous le splash encore opaque : l'écran
// d'arrivée est déjà en place quand le fondu le révèle.
function LaunchGate() {
  const { status } = useSession();
  const decided = useRef(false);
  const shownAt = useRef(Date.now());
  const opacity = useRef(new Animated.Value(1)).current;
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    if (status === 'loading' || decided.current) return;
    decided.current = true;
    if (status === 'anonymous' && !isWelcomeDismissed()) {
      router.replace('/welcome');
    }
    const remaining = Math.max(0, SPLASH_MIN_MS - (Date.now() - shownAt.current));
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
        useNativeDriver: true,
      }).start(() => setSplashGone(true));
    }, remaining);
    return () => clearTimeout(timer);
  }, [status, opacity]);

  if (splashGone) return null;
  return (
    <Animated.View
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity, zIndex: 10 }}
      pointerEvents={status === 'loading' ? 'auto' : 'none'}>
      <AppSplash />
    </Animated.View>
  );
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
