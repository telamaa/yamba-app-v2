/**
 * search/edit.tsx — « Modifier la recherche », la feuille du site en natif.
 * =========================================================================
 * Réf. capture 13/10 21h22 : un voile sombre, une feuille montée du bas aux
 * angles arrondis, une poignée, « Annuler · Modifier la recherche · Tout
 * effacer », la carte des trois champs avec le bouton d'inversion à cheval
 * sur les deux villes, et le CTA mangue épinglé en bas.
 *
 * Pourquoi une feuille et pas une page pleine : les résultats restent
 * VISIBLES derrière. Modifier une recherche, c'est ajuster quelque chose
 * qu'on a sous les yeux — le site l'avait déjà compris, et c'est le motif
 * des applications de voyage (Booking, Skyscanner).
 *
 * Elle est animée À LA MAIN (voile en fondu, feuille en translation, glisser
 * vers le bas pour fermer) plutôt que par la présentation native
 * `formSheet` : celle-ci enfermerait les étapes suivantes DANS la feuille,
 * alors que le choix d'une ville ou d'une date demande l'écran entier
 * (clavier + liste de suggestions, douze mois de calendrier).
 *
 * Elle n'applique RIEN elle-même : elle écrit dans le brouillon partagé et
 * lève le signal `requestSearch()` — l'écran Explorer reste seul maître de
 * l'appel serveur (il porte les pastilles, le tri et la pagination).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { summaryLabel } from '@/lib/search-date';
import {
  clearSearchDraft,
  getSearchDraft,
  requestSearch,
  subscribeSearchDraft,
  swapSearchDraft,
} from '@/lib/search-draft';

const OPEN_MS = 320;
const CLOSE_MS = 220;
/** Au-delà, le geste est une FERMETURE (la moitié de la feuille, ou un jeté
 *  franc) ; en deçà, la feuille revient se coller en place. */
const DISMISS_RATIO = 0.4;
const DISMISS_VELOCITY = 0.8;

export default function SearchEditSheet() {
  const t = useTranslations('search');
  const theme = useTheme();
  const locale = useLocale() as SupportedLocale;
  const insets = useSafeAreaInsets();

  const draft = useSyncExternalStore(subscribeSearchDraft, getSearchDraft, getSearchDraft);
  const { from, to, date } = draft;

  // Hauteur d'écran : la feuille part de SOUS l'écran, quelle que soit sa
  // hauteur réelle (mesurée trop tard pour l'animation d'entrée).
  const screenHeight = useRef(Dimensions.get('window').height).current;
  const translate = useRef(new Animated.Value(screenHeight)).current;
  const veil = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(screenHeight * 0.6);
  const closing = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, {
        toValue: 0,
        duration: OPEN_MS,
        // La courbe des feuilles natives : départ vif, arrivée posée.
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(veil, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [translate, veil]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(translate, {
        toValue: sheetHeight.current,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(veil, {
        toValue: 0,
        duration: CLOSE_MS,
        useNativeDriver: true,
      }),
    ]).start(() => router.back());
  }, [translate, veil]);

  // Le retour matériel Android ferme la feuille AVEC son animation (sans
  // cela, elle disparaît d'un coup : le geste le plus courant du système
  // serait le seul à ne pas être rendu).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  // Glisser la feuille vers le bas pour la fermer : le geste attendu sur les
  // deux OS. Il ne vit que sur la poignée et l'en-tête — pas sur les champs,
  // dont le toucher doit rester instantané.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dy > 0) translate.setValue(gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        const far = gesture.dy > sheetHeight.current * DISMISS_RATIO;
        if (far || gesture.vy > DISMISS_VELOCITY) {
          close();
          return;
        }
        Animated.spring(translate, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  const dateLabel = summaryLabel(date, locale, {
    any: t('form.datePlaceholder'),
    flex: {
      thisWeek: t('date.thisWeek'),
      thisMonth: t('date.thisMonth'),
      next3Months: t('date.next3Months'),
    },
  });

  const submit = useCallback(() => {
    requestSearch();
    close();
  }, [close]);

  return (
    <View style={styles.root}>
      {/* Le voile : il ferme au toucher, comme toute feuille native. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, { opacity: veil }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('edit.cancel')}
          onPress={close}
        />
      </Animated.View>

      <Animated.View
        style={[styles.sheetWrapper, { transform: [{ translateY: translate }] }]}
        onLayout={(event) => {
          sheetHeight.current = event.nativeEvent.layout.height;
        }}>
        <ThemedView style={styles.sheet}>
          <View {...pan.panHandlers}>
            <View style={styles.grabberRow}>
              <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
            </View>

            <View style={styles.header}>
              <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('edit.cancel')}
                </ThemedText>
              </Pressable>
              <ThemedText type="smallBold">{t('edit.title')}</ThemedText>
              <Pressable onPress={clearSearchDraft} hitSlop={10} accessibilityRole="button">
                <ThemedText type="smallBold" style={styles.clearAll}>
                  {t('edit.clearAll')}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
            <FieldRow
              label={t('form.fromLabel')}
              value={from}
              placeholder={t('form.fromPlaceholder')}
              icon="location-outline"
              tint="neutral"
              onPressAction={() => router.push('/search/city?field=from')}
            />
            <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />
            <FieldRow
              label={t('form.toLabel')}
              value={to}
              placeholder={t('form.toPlaceholder')}
              icon="location"
              tint="mango"
              onPressAction={() => router.push('/search/city?field=to')}
            />
            <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />
            <FieldRow
              label={t('form.dateLabel')}
              value={date !== null ? dateLabel : ''}
              placeholder={t('form.datePlaceholder')}
              icon="calendar-outline"
              tint="neutral"
              onPressAction={() => router.push('/search/date')}
            />

            {/* À cheval sur les deux villes, comme sur le site : l'inversion
                appartient visuellement à la frontière qu'elle franchit. */}
            <Pressable
              onPress={swapSearchDraft}
              accessibilityRole="button"
              accessibilityLabel={t('edit.swap')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.swap,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="swap-vertical" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View
            style={[
              styles.footer,
              {
                borderTopColor: theme.backgroundElement,
                paddingBottom: Math.max(insets.bottom, Spacing.three),
              },
            ]}>
            <Pressable
              onPress={submit}
              accessibilityRole="button"
              style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}>
              <Ionicons name="search" size={16} color="#0B0B0C" />
              <ThemedText type="smallBold" style={styles.submitLabel}>
                {t('form.submit')}
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </Animated.View>
    </View>
  );
}

/** Une ligne de la carte : pastille ronde, libellé en capitales, valeur ou
 *  son substitut. Le départ est neutre, la destination en mangue — la même
 *  distinction que le site (et la seule couleur de la carte). */
function FieldRow({
  label,
  value,
  placeholder,
  icon,
  tint,
  onPressAction,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: 'neutral' | 'mango';
  onPressAction: () => void;
}) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const filled = value.trim().length > 0;

  return (
    <Pressable
      onPress={onPressAction}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${filled ? value : placeholder}`}
      style={({ pressed }) => [styles.fieldRow, pressed && styles.pressed]}>
      <View
        style={[
          styles.fieldIcon,
          {
            backgroundColor:
              tint === 'mango'
                ? dark
                  ? 'rgba(255,153,0,0.2)'
                  : '#FFEDD5'
                : theme.backgroundElement,
          },
        ]}>
        <Ionicons
          name={icon}
          size={16}
          color={
            tint === 'mango' ? (dark ? '#FFB84D' : '#9A3412') : theme.textSecondary
          }
        />
      </View>
      <View style={styles.fieldTexts}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
          {label}
        </ThemedText>
        <ThemedText
          type="smallBold"
          style={styles.fieldValue}
          themeColor={filled ? 'text' : 'textSecondary'}
          numberOfLines={1}>
          {filled ? value : placeholder}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  veil: {
    backgroundColor: 'rgba(2,6,23,0.55)',
  },
  sheetWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  clearAll: {
    color: Brand.mango,
  },
  card: {
    marginHorizontal: Spacing.three,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldTexts: {
    flex: 1,
    gap: 1,
  },
  fieldLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three + 36 + Spacing.three,
  },
  swap: {
    position: 'absolute',
    right: Spacing.three,
    top: 64 - 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 52,
    borderRadius: 16,
    backgroundColor: Brand.mango,
  },
  submitPressed: {
    backgroundColor: '#F08700',
  },
  submitLabel: {
    color: '#0B0B0C',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.6,
  },
});
