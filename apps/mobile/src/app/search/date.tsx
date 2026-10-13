/**
 * search/date.tsx — choisir QUAND, en page dédiée.
 * ================================================
 * Les options sont celles du calendrier du site (`SmartDatePicker` /
 * `MobileSmartDatePicker`), à l'identique : deux modes — « Date précise » et
 * « Je suis flexible » — et trois raccourcis — « Cette semaine », « Ce
 * mois », « 3 prochains mois ». Les règles de fenêtre vivent dans
 * `search-date.ts` (miroir assumé du web) ; cet écran ne fait que les
 * présenter.
 *
 * Divergence mobile ASSUMÉE sur le rendu : le web surligne la fenêtre en
 * orange clair dans son calendrier. Ici, le mode précis utilise le VRAI
 * calendrier de l'OS (`DatePicker` SwiftUI `graphical` sur iOS, Material 3
 * sur Android, via `@expo/ui` — doctrine A207), qu'on ne peut pas repeindre.
 * Le mode flexible affiche donc la fenêtre EN TOUTES LETTRES sous les
 * raccourcis : un raccourci qui ne dit pas ce qu'il couvre demande à
 * l'utilisateur de deviner. On y gagne un calendrier natif plutôt qu'une
 * grille maison.
 *
 * Les modules par plateforme sont chargés PARESSEUSEMENT (`require` dans la
 * branche) : importer le paquet jetpack-compose sur iOS, et inversement,
 * enregistrerait les vues natives de l'autre OS.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayMonth } from '@/lib/trip-format';
import {
  FLEX_TYPES,
  makeExact,
  makeFlex,
  rangeLabel,
  startOfDay,
  type DateMode,
  type FlexType,
  type SearchDate,
} from '@/lib/search-date';
import { getSearchDraft, setSearchDraft } from '@/lib/search-draft';

export default function DateSearchScreen() {
  const t = useTranslations('search');
  const theme = useTheme();
  const locale = useLocale() as SupportedLocale;

  const initial = getSearchDraft().date;
  const [mode, setMode] = useState<DateMode>(initial?.mode ?? 'exact');
  const [value, setValue] = useState<SearchDate | null>(initial);

  const pickFlex = useCallback(
    (flexType: FlexType) => {
      setMode('flex');
      setValue(makeFlex(flexType, locale));
    },
    [locale]
  );

  const pickExact = useCallback((day: Date) => {
    setMode('exact');
    setValue(makeExact(day));
  }, []);

  /** Revenir au mode précis OUBLIE la fenêtre flexible : sans cela, l'écran
   *  montrerait un calendrier vide et « Appliquer » enverrait quand même
   *  « Cette semaine » — l'écran doit dire ce qu'il va faire. */
  const backToExact = useCallback(() => {
    setMode('exact');
    setValue((current) => (current?.mode === 'flex' ? null : current));
  }, []);

  const apply = useCallback(() => {
    setSearchDraft({ date: value });
    router.back();
  }, [value]);

  const clear = useCallback(() => {
    setSearchDraft({ date: null });
    router.back();
  }, []);

  const window = value !== null ? rangeLabel(value, locale) : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold">{t('date.title')}</ThemedText>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Les deux modes du web, en sélecteur segmenté. */}
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

          {mode === 'flex' ? (
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
                          ? {
                              backgroundColor: 'rgba(255,153,0,0.15)',
                              borderColor: 'rgba(255,153,0,0.5)',
                            }
                          : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
                      ]}>
                      <ThemedText
                        type="smallBold"
                        themeColor={active ? 'text' : 'textSecondary'}>
                        {t(`date.${flexType}`)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {window !== null && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.window}>
                  {window}
                </ThemedText>
              )}
            </View>
          ) : (
            <NativeCalendar
              initial={value?.mode === 'exact' ? value.date : null}
              onPickAction={pickExact}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={clear} hitSlop={8} accessibilityRole="button">
            <ThemedText type="small" themeColor="textSecondary">
              {t('date.clear')}
            </ThemedText>
          </Pressable>
          {/* Toujours ACTIF : la doctrine A209 réserve `disabled` au champ
              unique à validité évidente — ici, « appliquer sans date » est un
              geste légitime (toutes les dates). */}
          <Pressable
            onPress={apply}
            accessibilityRole="button"
            style={({ pressed }) => [styles.apply, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.applyLabel}>
              {t('date.apply')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ── Le calendrier de l'OS, en ligne (pas en feuille) ────────────────────── */

function NativeCalendar({
  initial,
  onPickAction,
}: {
  initial: Date | null;
  onPickAction: (day: Date) => void;
}) {
  const t = useTranslations('search');
  const theme = useTheme();
  const locale = useLocale() as SupportedLocale;

  if (Platform.OS === 'ios') {
    const { Host, DatePicker } = require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
    const { datePickerStyle } =
      require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');
    return (
      <View style={styles.calendar}>
        <Host matchContents>
          <DatePicker
            selection={initial ?? new Date()}
            displayedComponents={['date']}
            range={{ start: startOfDay(new Date()) }}
            onDateChange={onPickAction}
            modifiers={[datePickerStyle('graphical')]}
          />
        </Host>
      </View>
    );
  }

  // Android : le dialogue Material 3 ne s'intègre pas en ligne — un bouton
  // l'ouvre, et la date choisie s'affiche sous lui.
  return (
    <AndroidCalendar
      initial={initial}
      onPickAction={onPickAction}
      t={t}
      theme={theme}
      locale={locale}
    />
  );
}

function AndroidCalendar({
  initial,
  onPickAction,
  t,
  theme,
  locale,
}: {
  initial: Date | null;
  onPickAction: (day: Date) => void;
  t: ReturnType<typeof useTranslations<'search'>>;
  theme: ReturnType<typeof useTheme>;
  locale: SupportedLocale;
}) {
  const [open, setOpen] = useState(false);
  const { DateTimePicker } = require('@expo/ui/jetpack-compose') as typeof import('@expo/ui/jetpack-compose');

  return (
    <View style={styles.calendar}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.androidTrigger,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <ThemedText>
          {initial !== null ? formatDayMonth(initial, locale) : t('form.datePlaceholder')}
        </ThemedText>
      </Pressable>
      {open && (
        <DateTimePicker
          initialDate={(initial ?? new Date()).toISOString()}
          onDateSelected={(date: Date) => {
            onPickAction(date);
            setOpen(false);
          }}
          displayedComponents="date"
          variant="picker"
        />
      )}
    </View>
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
  scroll: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
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
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  flexBlock: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  window: {
    paddingLeft: Spacing.one,
  },
  calendar: {
    alignItems: 'center',
  },
  androidTrigger: {
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  apply: {
    flex: 1,
    backgroundColor: Brand.mango,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  applyLabel: {
    color: '#1A1205',
  },
  pressed: {
    opacity: 0.7,
  },
});
