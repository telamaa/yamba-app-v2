/**
 * search/city.tsx — choisir le départ ou la destination, en PAGE DÉDIÉE.
 * ======================================================================
 * Réf. capture 13/10 21h23 : une page pleine qui glisse depuis la droite,
 * un en-tête « ‹ Départ » aligné à gauche, puis la saisie NUE (une épingle,
 * un champ, rien autour) et les suggestions dessous. Pas de pilule, pas de
 * loupe : l'écran entier EST le champ, le clavier est déjà levé — c'est la
 * sobriété des écrans de recherche natifs (Maps, Uber, Booking).
 *
 * L'autocomplétion est celle du site, RÈGLE POUR RÈGLE
 * (`components/search/CityAutocomplete.tsx`) :
 *   • 2 caractères minimum, anti-rebond de 220 ms, 8 propositions au plus ;
 *   • jeton de session neuf PAR OUVERTURE (facturation Google) ;
 *   • une réponse en retard est jetée (la frappe qui l'a demandée est
 *     comparée à la frappe courante) ;
 *   • chaque ligne montre le nom en gras et son contexte en second ;
 *   • le choix est normalisé en « **Ville, Pays** » — c'est CE libellé que
 *     le serveur attend : `placeSearchTerm` (trip-service) ne garde que le
 *     premier segment avant la virgule, le pays n'est qu'une aide à la
 *     lecture (WEB-ACC-9 : sans cette règle, toute ville étrangère choisie
 *     dans la liste rendait zéro résultat).
 *
 * Seule divergence assumée avec le site : lui replie sur « France » quand
 * Google omet le pays, parce que son SDK est chargé avec `region=FR` ;
 * l'API REST d'ici n'a pas ce biais, donc un contexte vide reste vide
 * plutôt que d'inventer un pays.
 *
 * Sans clé ou API muette, la page reste une saisie LIBRE : la touche de
 * recherche du clavier valide le texte tapé. L'autocomplétion est un
 * confort, jamais un préalable (A207) — et l'écran le DIT (« suggestions
 * indisponibles »), au lieu de prétendre qu'aucune ville ne correspond :
 * accuser la saisie d'une panne de service est un mensonge d'interface.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { placeLabel, suggestCities, type CitySuggestion } from '@/lib/api/places.api';
import { getSearchDraft, setSearchDraft } from '@/lib/search-draft';

const DEBOUNCE_MS = 220;
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
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
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
        setLoading(false);
        return;
      }
      setLoading(true);
      timer.current = setTimeout(() => {
        void suggestCities(text, locale, sessionToken.current).then((result) => {
          if (queryAt.current !== text) return;
          setAvailable(result.status === 'ok');
          setSuggestions(result.status === 'ok' ? result.items : []);
          setLoading(false);
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
  const typing = query.trim().length >= MIN_CHARS;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* En-tête de page poussée : la flèche, puis le titre — aligné à
            gauche, pas centré : c'est le titre de l'ÉTAPE, pas d'une modale. */}
        <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle" style={styles.title}>
            {label}
          </ThemedText>
        </View>

        <View style={styles.inputRow}>
          <Ionicons name="location-outline" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            value={query}
            onChangeText={onChange}
            returnKeyType="search"
            onSubmitEditing={() => commit(query)}
            accessibilityLabel={label}
          />
          {/* Le site montre un rouage de chargement puis une croix : une
              croix NATIVE (`clearButtonMode`) n'existerait que sur iOS. */}
          {loading && <ActivityIndicator size="small" color={theme.textSecondary} />}
          {!loading && query.length > 0 && (
            <Pressable
              onPress={() => onChange('')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('city.clear')}>
              <View style={[styles.clear, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="close" size={12} color={theme.textSecondary} />
              </View>
            </Pressable>
          )}
        </View>

        <FlatList<CitySuggestion>
          data={suggestions}
          keyExtractor={(s) => `${s.main}·${s.secondary}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => (
            <View style={[styles.rowSeparator, { backgroundColor: theme.backgroundElement }]} />
          )}
          ListEmptyComponent={
            // Rien tant qu'on n'a pas assez tapé : un écran vide invite à
            // écrire. Ensuite, DEUX messages distincts — « aucune ville »
            // parle de la saisie, « indisponibles » parle du service, et
            // rappelle que la recherche marche quand même au texte tapé.
            typing && !loading ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.noResult}>
                {available ? t('city.noResult') : t('city.unavailable')}
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => commit(placeLabel(item))}
              accessibilityRole="button"
              accessibilityLabel={placeLabel(item)}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <View style={[styles.pin, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
              </View>
              <View style={styles.suggestionTexts}>
                <ThemedText type="smallBold" style={styles.suggestionMain} numberOfLines={1}>
                  {item.main}
                </ThemedText>
                {item.secondary.length > 0 && (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.secondary}
                  </ThemedText>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.backgroundSelected} />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    marginLeft: -Spacing.one,
  },
  title: {
    fontSize: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 0,
  },
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Spacing.four,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 36 + Spacing.three,
  },
  noResult: {
    paddingTop: Spacing.three,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
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
  suggestionMain: {
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});
