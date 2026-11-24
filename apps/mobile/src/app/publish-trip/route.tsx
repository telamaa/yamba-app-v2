/**
 * publish-trip/route.tsx — ② TON ITINÉRAIRE (phase « Trajet »)
 * ========================================================
 * Deux lignes, deux pages. Le site pose les deux villes côte à côte avec un
 * bouton d'inversion au milieu ; au pouce, la même disposition donne deux
 * champs de 140 px et une cible de 32 px entre les deux. Ici chaque ville est
 * une LIGNE pleine largeur qui ouvre la page de saisie (le même geste que la
 * recherche, et le même composant depuis ce lot), et l'inversion est une
 * action nommée sous les deux lignes plutôt qu'un glyphe coincé entre elles.
 *
 * L'ordre « départ puis destination » n'est jamais inversé : c'est l'ordre du
 * voyage, et celui de la recherche côté Expéditeur.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslations } from 'use-intl';

import { PublishStepFrame } from '@/components/publish/publish-step-frame';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import { manquesDeLEcran, type VilleChoisie } from '@/lib/publish-trip';

export default function PublishRouteScreen() {
  const t = useTranslations('publish');
  const theme = useTheme();
  const draft = usePublishDraft();
  const [montreLesManques, setMontreLesManques] = useState(false);

  const manques = manquesDeLEcran(2, draft, new Date());

  const onContinue = useCallback(() => {
    if (manques.length > 0) {
      setMontreLesManques(true);
      return;
    }
    setMontreLesManques(false);
    router.push('/publish-trip/when');
  }, [manques.length]);

  const inverser = useCallback(() => {
    setPublishDraft({ depart: draft.arrivee, arrivee: draft.depart });
  }, [draft.depart, draft.arrivee]);

  const route =
    draft.depart !== null && draft.arrivee !== null
      ? t('bar.route', { from: draft.depart.ville, to: draft.arrivee.ville })
      : t('bar.newTrip');

  return (
    <PublishStepFrame
      title={t('route.title')}
      step={2}
      valueLabel={route}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        <Ligne
          label={t('route.from')}
          placeholder={t('route.fromPlaceholder')}
          valeur={draft.depart}
          onPressAction={() => router.push('/publish-trip/city?field=from')}
        />
        <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />
        <Ligne
          label={t('route.to')}
          placeholder={t('route.toPlaceholder')}
          valeur={draft.arrivee}
          onPressAction={() => router.push('/publish-trip/city?field=to')}
        />
      </View>

      {/* L'inversion n'a de sens que lorsqu'il y a deux villes à inverser. */}
      {draft.depart !== null || draft.arrivee !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('route.swap')}
          onPress={inverser}
          style={({ pressed }) => [styles.swap, pressed && styles.pressed]}>
          <Ionicons name="swap-vertical" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('route.swap')}
          </ThemedText>
        </Pressable>
      ) : null}

      {montreLesManques && manques.length > 0 ? (
        <View style={styles.manques}>
          {manques.map((manque) => (
            <View key={manque} style={styles.manque}>
              <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
              <ThemedText type="small" style={{ color: Brand.mango }}>
                {t(`missing.${manque}`)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </PublishStepFrame>
  );

  function Ligne({
    label,
    placeholder,
    valeur,
    onPressAction,
  }: {
    label: string;
    placeholder: string;
    valeur: VilleChoisie | null;
    onPressAction: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${valeur?.libelle ?? placeholder}`}
        onPress={onPressAction}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="location-outline" size={18} color={theme.textSecondary} />
        <View style={styles.rowTexts}>
          <ThemedText type="small" themeColor="textSecondary">
            {label}
          </ThemedText>
          {valeur === null ? (
            // D103 5A — un marque-place ne se met JAMAIS au poids de la
            // valeur : il se distinguerait de la ville choisie par la seule
            // couleur, ce qui n'est pas une hiérarchie.
            <ThemedText type="small" themeColor="textSecondary">
              {placeholder}
            </ThemedText>
          ) : (
            <ThemedText type="smallBold" numberOfLines={1}>
              {valeur.libelle}
            </ThemedText>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.backgroundSelected} />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    minHeight: 64,
  },
  rowTexts: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  swap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    marginTop: -Spacing.three,
  },
  manques: {
    gap: Spacing.one,
  },
  manque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
