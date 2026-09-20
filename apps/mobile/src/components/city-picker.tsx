/**
 * city-picker.tsx — la saisie de ville PLEIN ÉCRAN (lot recherche-first).
 * =======================================================================
 * Le motif natif des deux OS (celui de la référence) : toucher le champ
 * ouvre un écran de saisie dédié — clavier levé d'office, grande zone de
 * frappe, suggestions en liste — et choisir referme. Les suggestions
 * viennent de l'API REST Places (`places.api.ts`, le canal miroir du web) ;
 * sans clé ou API muette, l'écran reste une saisie LIBRE : « OK » du
 * clavier valide le texte tapé tel quel. Jeton de session renouvelé à
 * chaque ouverture (la convention Google : un jeton par saisie).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suggestCities, type CitySuggestion } from '@/lib/api/places.api';

const DEBOUNCE_MS = 250;

function newSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Props = {
  visible: boolean;
  /** Le libellé du champ d'origine (« Départ » / « Destination »). */
  label: string;
  placeholder: string;
  initialValue: string;
  onPickAction: (city: string) => void;
  onCloseAction: () => void;
};

export function CityPicker({
  visible,
  label,
  placeholder,
  initialValue,
  onPickAction,
  onCloseAction,
}: Props) {
  const t = useTranslations('search');
  const theme = useTheme();
  const locale = useLocale();
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const sessionToken = useRef(newSessionToken());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La frappe qui a déclenché la requête : une réponse en retard est jetée.
  const queryAt = useRef('');

  // Chaque ouverture repart de la valeur du champ, session Google neuve.
  useEffect(() => {
    if (!visible) return;
    setQuery(initialValue);
    setSuggestions([]);
    sessionToken.current = newSessionToken();
  }, [visible, initialValue]);

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
      if (text.trim().length < 2) {
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

  const submitFreeText = useCallback(() => {
    onPickAction(query.trim());
  }, [onPickAction, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCloseAction}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <Pressable onPress={onCloseAction} hitSlop={Spacing.two}>
              <ThemedText type="linkPrimary">{t('form.cancel')}</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{label}</ThemedText>
            {/* Équilibre le bouton Annuler pour centrer le titre. */}
            <View style={styles.headerSpacer} />
          </View>

          <TextInput
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            value={query}
            onChangeText={onChange}
            returnKeyType="done"
            onSubmitEditing={submitFreeText}
            clearButtonMode="while-editing"
          />

          <FlatList<CitySuggestion>
            data={suggestions}
            keyExtractor={(s) => `${s.main}·${s.secondary}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPickAction(item.main)}
                style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                <ThemedText>{item.main}</ThemedText>
                {item.secondary.length > 0 && (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.secondary}
                  </ThemedText>
                )}
              </Pressable>
            )}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />
            )}
          />
        </SafeAreaView>
      </ThemedView>
    </Modal>
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
    paddingVertical: Spacing.three,
  },
  headerSpacer: {
    width: 56,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  suggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
