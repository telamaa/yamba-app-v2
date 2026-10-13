/**
 * search/city.tsx — choisir le départ ou la destination, en PAGE DÉDIÉE.
 * ======================================================================
 * Une vraie page poussée qui glisse depuis la droite, pas une feuille
 * modale : c'est ce que font les applications natives, et c'est ce que le
 * web lui-même imite (`MobileFieldFullScreen` : « sub-screen mobile plein
 * écran qui slide depuis la droite, pattern iOS natif »). Ici on ne l'imite
 * pas, on l'a.
 *
 * Le champ visé arrive en paramètre de route (`field=from|to`) ; le choix
 * repart par le brouillon partagé (`search-draft.ts`) — une page poussée ne
 * retourne pas de valeur.
 *
 * Les suggestions viennent de l'API REST Places (`places.api.ts`, le canal
 * miroir du web) : 2 caractères minimum, anti-rebond de 250 ms, une réponse
 * en retard est jetée, et un jeton de session neuf PAR OUVERTURE (la
 * convention de facturation de Google).
 *
 * Sans clé ou API muette, la page reste une saisie LIBRE : « OK » au clavier
 * valide le texte tapé. L'autocomplétion est un confort, jamais un préalable
 * (A207).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suggestCities, type CitySuggestion } from '@/lib/api/places.api';
import { getSearchDraft, setSearchDraft } from '@/lib/search-draft';

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

function newSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CitySearchScreen() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const target: 'from' | 'to' = field === 'to' ? 'to' : 'from';

  const t = useTranslations('search');
  const theme = useTheme();
  const locale = useLocale();

  const [query, setQuery] = useState(() => getSearchDraft()[target]);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const sessionToken = useRef(newSessionToken());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La frappe qui a déclenché la requête : une réponse en retard est jetée.
  const queryAt = useRef('');

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );

  const onChange = useCallback(
    (text: string) => {
      setQuery(text);
      queryAt.current = text;
      if (timer.current !== null) clearTimeout(timer.current);
      if (text.trim().length < MIN_CHARS) {
        setSuggestions([]);
        return;
      }
      timer.current = setTimeout(() => {
        void suggestCities(text, locale, sessionToken.current).then((items) => {
          if (queryAt.current === text) setSuggestions(items);
        });
      }, DEBOUNCE_MS);
    },
    [locale]
  );

  const commit = useCallback(
    (city: string) => {
      setSearchDraft({ [target]: city.trim() } as { from: string } | { to: string });
      router.back();
    },
    [target]
  );

  const label = target === 'to' ? t('form.toLabel') : t('form.fromLabel');
  const placeholder = target === 'to' ? t('form.toPlaceholder') : t('form.fromPlaceholder');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold">{label}</ThemedText>
          {/* Équilibre la flèche pour que le titre soit vraiment centré. */}
          <View style={styles.back} />
        </View>

        <View style={[styles.inputRow, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            value={query}
            onChangeText={onChange}
            returnKeyType="done"
            onSubmitEditing={() => commit(query)}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList<CitySuggestion>
          data={suggestions}
          keyExtractor={(s) => `${s.main}·${s.secondary}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => commit(item.main)}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <View style={[styles.pin, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
              </View>
              <View style={styles.suggestionTexts}>
                <ThemedText numberOfLines={1}>{item.main}</ThemedText>
                {item.secondary.length > 0 && (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.secondary}
                  </ThemedText>
                )}
              </View>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  back: {
    width: 32,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 0,
  },
  list: {
    paddingTop: Spacing.three,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTexts: {
    flex: 1,
    gap: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
