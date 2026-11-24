/**
 * publish-trip/index.tsx — ① TON VOYAGE (phase « Trajet »)
 * =========================================================
 * Le mode, son type, et les deux villes — sur UN écran.
 *
 * POURQUOI LA FUSION (retour de revue du 25/11). Les deux écrans d'origine
 * demandaient l'un trois taps, l'autre deux lignes, et laissaient chacun les
 * deux tiers de la hauteur vides. Du blanc est une respiration **quand la
 * décision est lourde** ; ici elle ne l'était pas — c'était juste du vide.
 * Réunis, ils forment UN objet (« ton voyage »), le tunnel passe de sept
 * écrans à six, et la règle « une question par écran » est respectée : la
 * question est « quel voyage ? », pas « quel mode ? » puis « quelles villes ? ».
 *
 * L'ORDRE INTERNE N'EST PAS LIBRE : le mode vient en premier parce qu'il
 * décide des lieux d'échange proposés à l'étape ⑤ (`choisirMode` les pose).
 *
 * « Aller simple / Aller-retour » du site n'est PAS repris, et c'est une
 * décision : le mapper web envoie `returnDepartureAt: null` dans les deux cas
 * et ne crée aucun second trajet — le choix n'ajoute qu'un mot sur la fiche
 * du Voyageur. Un contrôle qui affirme ce que le produit ne fait pas est le
 * défaut de D100. Le retour se publie désormais pour de vrai, en un geste,
 * depuis l'écran de fin (`publish-trip/done`).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTranslations } from 'use-intl';

import { PublishStepFrame } from '@/components/publish/publish-step-frame';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { choisirMode, setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import {
  MODES,
  SOUS_TYPES,
  demandeDesEscales,
  manquesDeLEcran,
  type TransportMode,
  type VilleChoisie,
} from '@/lib/publish-trip';

const ICONES: Record<TransportMode, keyof typeof Ionicons.glyphMap> = {
  PLANE: 'airplane-outline',
  TRAIN: 'train-outline',
  CAR: 'car-outline',
};

export default function PublishTripScreen() {
  const t = useTranslations('publish');
  const theme = useTheme();
  const draft = usePublishDraft();
  const [montreLesManques, setMontreLesManques] = useState(false);

  const manques = manquesDeLEcran(1, draft, new Date());

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
      title={t('mode.title')}
      step={1}
      valueLabel={route}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      <View style={styles.modes}>
        {MODES.map((mode) => {
          const choisi = draft.mode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ selected: choisi }}
              accessibilityLabel={t(`mode.${mode}`)}
              onPress={() => choisirMode(mode)}
              style={({ pressed }) => [
                styles.modeCard,
                {
                  borderColor: choisi ? Brand.mango : theme.backgroundElement,
                  backgroundColor: choisi ? theme.backgroundElement : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons
                name={ICONES[mode]}
                size={26}
                color={choisi ? Brand.mango : theme.textSecondary}
              />
              <ThemedText type="smallBold">{t(`mode.${mode}`)}</ThemedText>
              {/* La conséquence du choix, écrite SUR le choix : le mode décide
                  des lieux d'échange qu'on proposera à l'étape ⑤. */}
              <ThemedText type="small" themeColor="textSecondary" style={styles.modeHint}>
                {t(`mode.${mode}_hint`)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Le sous-type n'apparaît qu'une fois le mode choisi : il n'a aucun sens
          avant, et trois paires de pastilles affichées d'avance feraient lire
          un écran deux fois plus long qu'il n'est. */}
      {draft.mode !== null ? (
        <View style={styles.group}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t(`mode.${draft.mode}_typeTitle`)}
          </ThemedText>
          <View style={styles.chips}>
            {SOUS_TYPES[draft.mode].map((sousType) => {
              const choisi = draft.sousType === sousType;
              return (
                <Pressable
                  key={sousType}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisi }}
                  onPress={() => setPublishDraft({ sousType })}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: choisi ? Brand.mango : theme.backgroundElement,
                      backgroundColor: choisi ? theme.backgroundElement : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <ThemedText type={choisi ? 'smallBold' : 'small'}>
                    {t(`mode.${draft.mode}_${sousType}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {demandeDesEscales(draft.mode, draft.sousType) ? (
        <View style={styles.group}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('mode.stopsTitle')}
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
            value={draft.escales}
            onChangeText={(escales) => setPublishDraft({ escales })}
            placeholder={t('mode.stopsPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            accessibilityLabel={t('mode.stopsTitle')}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('mode.stopsHint')}
          </ThemedText>
        </View>
      ) : null}

      {/* Les deux villes. Chacune est une LIGNE pleine largeur qui ouvre la
          page de saisie — au pouce, deux champs côte à côte donnent deux
          cibles de 140 px et un bouton d'inversion de 32 px entre elles. */}
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

      {/* Le bouton reste ACTIF quand l'étape est incomplète (A209) : au tap,
          il NOMME ce qui manque. Un bouton gris ne dit pas pourquoi. */}
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
            // D103 5A — un marque-place ne se met jamais au poids de la valeur.
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
  modes: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  modeCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: Spacing.two,
  },
  modeHint: {
    textAlign: 'center',
  },
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    fontSize: 15,
  },
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
