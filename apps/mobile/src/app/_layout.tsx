import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Brand } from '@/constants/theme';
import { AppIntlProvider } from '@/i18n/provider';

// Socle : une pile simple. Les onglets natifs (Rechercher / Trajets /
// Messages / Profil) arriveront avec les parcours — pas avant d'avoir
// des écrans à mettre dedans.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: Brand.mango } };

  return (
    <AppIntlProvider>
      <ThemeProvider value={theme}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </AppIntlProvider>
  );
}
