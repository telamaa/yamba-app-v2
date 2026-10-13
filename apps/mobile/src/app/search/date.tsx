/**
 * search/date.tsx — choisir QUAND, en page dédiée.
 * ================================================
 * Réf. capture 13/10 21h23 : « ‹ Quand pars-tu ? », le sélecteur segmenté
 * « Date précise » / « Je suis flexible », le calendrier, et « Appliquer »
 * épinglé en bas. Mêmes options que le site (`SmartDatePicker` /
 * `MobileSmartDatePicker`), mêmes fenêtres, mêmes libellés : une recherche
 * lancée du téléphone et la même lancée du navigateur trouvent les mêmes
 * trajets. Les règles vivent dans `search-date.ts`, cet écran les présente.
 *
 * Le calendrier reste AFFICHÉ dans les deux modes (comme le site) : en
 * flexible, les raccourcis s'ajoutent au-dessus et la fenêtre choisie se
 * PEINT dans la grille — c'est ce qui rend « 3 prochains mois » concret.
 * Toucher un jour repasse en mode précis : le geste parle plus fort que
 * l'onglet.
 *
 * Le `DatePicker` de `@expo/ui` (doctrine A207) est abandonné ici — voir
 * l'en-tête de `components/search-calendar.tsx` pour les trois raisons.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { SearchCalendar } from '@/components/search-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import {
  FLEX_TYPES,
  makeExact,
  makeFlex,
  rangeLabel,
  type DateMode,
  type FlexType,
  type SearchDate,
} from '@/lib/search-date';
import { getSearchDraft, setSearchDraft } from '@/lib/search-draft';

export default function DateSearchScreen() {
  const t = useTranslations('search');
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const locale = useLocale() as SupportedLocale;

  const [initial] = useState(() => getSearchDraft().date);
  const [mode, setMode] = useState<DateMode>(initial?.mode ?? 'exact');
  const [value, setValue] = useState<SearchDate | null>(initial);

  const pickFlex = useCallback(
    (flexType: FlexType) => {
      setMode('flex');
      setValue(makeFlex(flexType, locale));
    },
    [locale]
  );

  // Toucher un jour, c'est choisir une date précise — même quand on venait
  // de l'onglet flexible (le geste du site, à l'identique).
  const pickDay = useCallback((day: Date) => {
    setMode('exact');
    setValue(makeExact(day));
  }, []);

  /** Revenir au mode précis OUBLIE la fenêtre flexible : sans cela, le
   *  calendrier n'afficherait plus rien de sélectionné alors qu'« Appliquer »
   *  enverrait encore « Cette semaine ». */
  const backToExact = useCallback(() => {
    setMode('exact');
    setValue((current) => (current?.mode === 'flex' ? null : current));
  }, []);

  const apply = useCallback(() => {
    setSearchDraft({ date: value });
    router.back();
  }, [value]);

  const window = value !== null ? rangeLabel(value, locale) : null;

  return (
    <ThemedView style={styles.container}>
      {/* Bord BAS compris : « Appliquer » ne doit pas toucher la barre
          gestuelle (iPhone) ni la barre de navigation (Android). */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle" style={styles.title}>
            {t('date.title')}
          </ThemedText>
        </View>

        <View style={styles.body}>
          {/* Les deux modes du site, en sélecteur segmenté. */}
          <View style={[styles.segments, { backgroundColor: theme.backgroundElement }]}>
            {(['exact', 'flex'] as const).map((key) => {
              const active = key === mode;
              return (
                <Pressable
                  key={key}
                  onPress={() => (key === 'flex' ? pickFlex('thisWeek') : backToExact())}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.segment, active && { backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                    {t(`date.${key}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {mode === 'flex' && (
            <View style={styles.flexBlock}>
              <View style={styles.chips}>
                {FLEX_TYPES.map((flexType) => {
                  const active = value?.flexType === flexType;
                  return (
                    <Pressable
                      key={flexType}
                      onPress={() => pickFlex(flexType)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.chip,
                        pressed && styles.pressed,
                        active
                          ? { backgroundColor: Brand.mango, borderColor: Brand.mango }
                          : {
                              backgroundColor: theme.backgroundElement,
                              borderColor: 'transparent',
                            },
                      ]}>
                      <ThemedText
                        type="smallBold"
                        style={active ? styles.chipActiveLabel : undefined}
                        themeColor={active ? undefined : 'textSecondary'}>
                        {t(`date.${flexType}`)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {window !== null && (
                <ThemedText
                  type="small"
                  style={[styles.window, { color: dark ? '#FFB84D' : '#B45309' }]}>
                  {window}
                </ThemedText>
              )}
            </View>
          )}

          <SearchCalendar value={value} onPickDayAction={pickDay} locale={locale} />
        </View>

        <View style={[styles.footer, { borderTopColor: theme.backgroundElement }]}>
          {/* Toujours ACTIF : la doctrine A209 réserve `disabled` au champ
              unique à validité évidente — « appliquer sans date » est un
              geste légitime (toutes les dates). */}
          <Pressable
            onPress={apply}
            accessibilityRole="button"
            style={({ pressed }) => [styles.apply, pressed && styles.applyPressed]}>
            <ThemedText type="smallBold" style={styles.applyLabel}>
              {t('date.apply')}
            </ThemedText>
          </Pressable>
        </View>
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
  body: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  flexBlock: {
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActiveLabel: {
    color: '#0B0B0C',
  },
  window: {
    paddingLeft: 2,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  apply: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.mango,
  },
  applyPressed: {
    backgroundColor: '#F08700',
  },
  applyLabel: {
    color: '#0B0B0C',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.6,
  },
});
