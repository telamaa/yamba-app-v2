/**
 * city-picker.tsx — choisir une ville, en page pleine. UN SEUL exemplaire.
 * =========================================================================
 * L'écran existait déjà pour la RECHERCHE (`app/search/city.tsx`, réf. capture
 * 13/10 21h23). La publication demande exactement le même geste — une page qui
 * glisse depuis la droite, un en-tête aligné à gauche, la saisie NUE (une
 * épingle, un champ, rien autour), les suggestions dessous, le clavier déjà
 * levé —, et c'est précisément là que ce dépôt a l'habitude de se faire mal :
 * on recopie, les deux copies divergent, et une fiche qui compare des RÈGLES
 * ne voit rien parce que les deux fichiers sont justes séparément (D110 :
 * une source de vérité qu'on n'importe pas est un commentaire).
 *
 * Le composant porte donc le GESTE et les règles de l'autocomplétion, les
 * deux routes ne portent plus que leurs mots et ce qu'elles font du choix.
 *
 * Les règles, reprises du site mot pour mot (`CityAutocomplete.tsx`) :
 *   • 2 caractères minimum, anti-rebond de 220 ms, 8 propositions au plus ;
 *   • jeton de session neuf PAR OUVERTURE (facturation Google) ;
 *   • une réponse en retard est jetée (la frappe qui l'a demandée est
 *     comparée à la frappe courante) ;
 *   • le choix est normalisé en « Ville, Pays » (`placeLabel`, WEB-ACC-9).
 *
 * Sans clé ou API muette, la page reste une saisie LIBRE : la touche de
 * recherche du clavier valide le texte tapé, ET une ligne de sortie le dit à
 * l'écran — une issue qui n'existe que sur une touche de clavier n'est pas
 * une issue (D103 3A).
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale } from 'use-intl';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suggestCities, type CitySuggestion } from '@/lib/api/places.api';
import { placeCountry, placeLabel } from '@/lib/place-label';

const DEBOUNCE_MS = 220;
const MIN_CHARS = 2;

/** Ce qu'une page rend à celle qui l'a ouverte : la ville, son pays, le libellé. */
export type VilleSaisie = { ville: string; pays: string; libelle: string };

export type CityPickerTextes = {
  back: string;
  clear: string;
  noResult: string;
  unavailable: string;
  /** « Utiliser « Paris » » — la ligne de sortie quand rien ne correspond. */
  useTyped: (ville: string) => string;
};

function nouveauJeton(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CityPicker({
  title,
  placeholder,
  initial,
  textes,
  topInset,
  onCloseAction,
  onPickAction,
}: {
  /** Le titre de l'ÉTAPE (« Départ »), aligné à gauche — pas celui d'une modale. */
  title: string;
  placeholder: string;
  initial: string;
  textes: CityPickerTextes;
  /** La marge haute de l'écran poussé — `useTopInset`, jamais l'inset seul (D107). */
  topInset: number;
  onCloseAction: () => void;
  onPickAction: (ville: VilleSaisie) => void;
}) {
  const theme = useTheme();
  const locale = useLocale();

  const [query, setQuery] = useState(initial);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const jeton = useRef(nouveauJeton());
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La frappe qui a déclenché la requête : une réponse en retard est jetée.
  const frappeDemandee = useRef('');

  useEffect(
    () => () => {
      if (minuteur.current !== null) clearTimeout(minuteur.current);
    },
    []
  );

  const onChange = useCallback(
    (text: string) => {
      setQuery(text);
      frappeDemandee.current = text;
      if (minuteur.current !== null) clearTimeout(minuteur.current);
      if (text.trim().length < MIN_CHARS) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      minuteur.current = setTimeout(() => {
        void suggestCities(text, locale, jeton.current).then((result) => {
          if (frappeDemandee.current !== text) return;
          setAvailable(result.status === 'ok');
          setSuggestions(result.status === 'ok' ? result.items : []);
          setLoading(false);
        });
      }, DEBOUNCE_MS);
    },
    [locale]
  );

  /** Le texte tapé, sans suggestion : on n'invente ni pays ni contexte. */
  const commitTexte = useCallback(
    (texte: string) => {
      const ville = texte.trim();
      if (ville.length === 0) return;
      onPickAction({ ville, pays: '', libelle: ville });
    },
    [onPickAction]
  );

  const commitSuggestion = useCallback(
    (item: CitySuggestion) => {
      onPickAction({ ville: item.main, pays: placeCountry(item), libelle: placeLabel(item) });
    },
    [onPickAction]
  );

  const typing = query.trim().length >= MIN_CHARS;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* D107 — le bord HAUT ne passe PAS par `SafeAreaView` : son inset rend
            ZÉRO dans une pile présentée en `transparentModal`. On prend le
            maximum de l'inset et de la hauteur de barre d'état de l'appareil. */}
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.backgroundElement, paddingTop: topInset + Spacing.two },
          ]}>
          <BackButton label={textes.back} onPress={onCloseAction} />
          <ThemedText type="subtitle" style={styles.title}>
            {title}
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
            onSubmitEditing={() => commitTexte(query)}
            accessibilityLabel={title}
          />
          {loading && <ActivityIndicator size="small" color={theme.textSecondary} />}
          {!loading && query.length > 0 && (
            <Pressable
              onPress={() => onChange('')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={textes.clear}>
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
            // parle de la saisie, « indisponibles » parle du service.
            typing && !loading ? (
              <View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.noResult}>
                  {available ? textes.noResult : textes.unavailable}
                </ThemedText>
                <Pressable
                  onPress={() => commitTexte(query)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                  <View style={[styles.pin, { backgroundColor: theme.backgroundElement }]}>
                    <Ionicons name="search" size={18} color={theme.text} />
                  </View>
                  <ThemedText numberOfLines={1} style={styles.useTyped}>
                    {textes.useTyped(query.trim())}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => commitSuggestion(item)}
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
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  useTyped: {
    flex: 1,
    minWidth: 0,
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
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.6,
  },
});
