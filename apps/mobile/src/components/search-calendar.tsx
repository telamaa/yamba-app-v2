/**
 * search-calendar.tsx — le calendrier de la recherche, en natif.
 * ==============================================================
 * Le site affiche UN mois à la fois avec deux flèches ‹ › : c'est le geste
 * d'une souris. Sur un téléphone, la référence du domaine (Airbnb, Booking,
 * SNCF Connect, Google Flights) fait DÉFILER les mois verticalement — on
 * balaie au pouce, on ne vise pas une flèche de 36 pt. Même grille, mêmes
 * couleurs, même semaine locale que le web ; seul le mode de parcours est
 * natif. Les en-têtes de colonnes restent FIXES au-dessus du défilement.
 *
 * Il remplace le `DatePicker` de `@expo/ui` (doctrine A207) pour trois
 * raisons mesurées à l'implémentation : le sélecteur de l'OS ne sait PAS
 * peindre la fenêtre « Je suis flexible » (c'est la moitié de l'écran de
 * date), il ne se teinte pas en mangue, et sur Android il n'existe qu'en
 * DIALOGUE — un bouton puis une boîte, là où iOS affichait une grille en
 * ligne : deux parcours différents pour une même étape.
 *
 * Zéro dépendance : la grille est du calcul pur (`search-date.ts`), les
 * libellés viennent des tables de `trip-format.ts` (jamais `Intl`, dont les
 * données dépendent du moteur Hermes).
 */
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import {
  isSameDay,
  isWithin,
  monthMatrix,
  monthsFrom,
  startOfDay,
  weekStartFor,
  type SearchDate,
} from '@/lib/search-date';
import { formatLongDate, formatMonthYear, weekdayLabels } from '@/lib/trip-format';

/** Un an devant : au-delà, aucun trajet n'est publié (et on garde la liste
 *  légère — douze grilles suffisent à couvrir toute intention réelle). */
const MONTHS_AHEAD = 12;

type Props = {
  value: SearchDate | null;
  onPickDayAction: (day: Date) => void;
  locale: SupportedLocale;
};

export function SearchCalendar({ value, onPickDayAction, locale }: Props) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const weekStartsOn = weekStartFor(locale);

  const today = useMemo(() => startOfDay(new Date()), []);
  const months = useMemo(() => monthsFrom(today, MONTHS_AHEAD), [today]);
  const labels = useMemo(() => weekdayLabels(weekStartsOn, locale), [weekStartsOn, locale]);

  const selected = value?.mode === 'exact' ? value.date : null;
  const rangeStart = value?.mode === 'flex' ? (value.rangeStart ?? null) : null;
  const rangeEnd = value?.mode === 'flex' ? (value.rangeEnd ?? null) : null;

  const renderMonth = useCallback(
    ({ item }: { item: Date }) => (
      <Month
        month={item}
        weekStartsOn={weekStartsOn}
        locale={locale}
        today={today}
        selected={selected}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        dark={dark}
        onPickDayAction={onPickDayAction}
      />
    ),
    [weekStartsOn, locale, today, selected, rangeStart, rangeEnd, dark, onPickDayAction]
  );

  return (
    <View style={styles.container}>
      {/* Les colonnes ne défilent pas : savoir quel jour est quelle colonne
          doit rester vrai au douzième mois. */}
      <View style={[styles.weekdays, { borderBottomColor: theme.backgroundElement }]}>
        {labels.map((label) => (
          <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.weekday}>
            {label}
          </ThemedText>
        ))}
      </View>
      <FlatList<Date>
        data={months}
        keyExtractor={(month) => `${month.getFullYear()}-${month.getMonth()}`}
        renderItem={renderMonth}
        initialNumToRender={2}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function Month({
  month,
  weekStartsOn,
  locale,
  today,
  selected,
  rangeStart,
  rangeEnd,
  dark,
  onPickDayAction,
}: {
  month: Date;
  weekStartsOn: 0 | 1;
  locale: SupportedLocale;
  today: Date;
  selected: Date | null;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  dark: boolean;
  onPickDayAction: (day: Date) => void;
}) {
  const theme = useTheme();
  const weeks = useMemo(() => monthMatrix(month, weekStartsOn), [month, weekStartsOn]);

  return (
    <View style={styles.month}>
      <ThemedText type="smallBold" style={styles.monthTitle}>
        {formatMonthYear(month, locale)}
      </ThemedText>
      {weeks.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((day, position) => {
            if (day === null) return <View key={`empty-${position}`} style={styles.cell} />;

            const past = day.getTime() < today.getTime();
            const isToday = isSameDay(day, today);
            const isSelected = selected !== null && isSameDay(day, selected);
            // Un jour PASSÉ n'est jamais peint, même dans la fenêtre : « Cette
            // semaine » commence lundi, mais la recherche part d'aujourd'hui
            // (`dateBounds` ramène la borne) — la grille dit la même chose.
            const inRange =
              !isSelected &&
              !past &&
              rangeStart !== null &&
              rangeEnd !== null &&
              isWithin(day, rangeStart, rangeEnd);

            // Trois peintures exclusives, dans l'ordre de priorité : le jour
            // choisi (mangue pleine), la fenêtre flexible (mangue pâle), le
            // jour même (anneau). Les jours passés ne se touchent pas.
            const background = isSelected
              ? Brand.mango
              : inRange
                ? dark
                  ? 'rgba(255,153,0,0.15)'
                  : '#FFF6E8'
                : 'transparent';
            const color = isSelected
              ? '#0B0B0C'
              : inRange
                ? dark
                  ? '#FFB84D'
                  : '#B45309'
                : past
                  ? theme.textSecondary
                  : isToday
                    ? dark
                      ? '#FFB84D'
                      : Brand.mangoDark
                    : theme.text;

            return (
              <Pressable
                key={day.getTime()}
                disabled={past}
                onPress={() => onPickDayAction(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: past }}
                accessibilityLabel={formatLongDate(day.toISOString(), locale)}
                style={({ pressed }) => [
                  styles.cell,
                  pressed && styles.pressed,
                  past && styles.past,
                ]}>
                <View
                  style={[
                    styles.dayPaint,
                    { backgroundColor: background },
                    isToday &&
                      !isSelected && {
                        borderWidth: 1,
                        borderColor: dark ? 'rgba(255,184,77,0.6)' : 'rgba(255,153,0,0.6)',
                      },
                  ]}>
                  <ThemedText
                    style={[styles.dayLabel, { color }, (isSelected || isToday) && styles.dayStrong]}>
                    {day.getDate()}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weekdays: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.two,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  list: {
    paddingBottom: Spacing.four,
  },
  month: {
    paddingTop: Spacing.four,
  },
  monthTitle: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    paddingBottom: Spacing.two,
  },
  week: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
  cell: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPaint: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
  },
  dayStrong: {
    fontWeight: 700,
  },
  past: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.6,
  },
});
