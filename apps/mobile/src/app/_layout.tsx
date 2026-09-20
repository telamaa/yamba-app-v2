import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Brand } from '@/constants/theme';
import { AppIntlProvider } from '@/i18n/provider';
import { SessionProvider } from '@/lib/session-context';

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
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            {/* La fiche trajet se pousse PAR-DESSUS les onglets (pas dedans) :
                le retour ramène aux résultats, la barre reste celle du groupe. */}
            <Stack.Screen name="trip/[id]" />
          </Stack>
        </ThemeProvider>
      </SessionProvider>
    </AppIntlProvider>
  );
}
