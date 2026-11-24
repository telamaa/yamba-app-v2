/**
 * publish-trip/index.tsx — ① COMMENT VOYAGES-TU ? (phase « Trajet »)
 * ==============================================================
 * Le site pose cette question dans un formulaire qui en pose six autres en
 * même temps (mode, type d'annonce, itinéraire, dates, horaires, justificatif
 * — capture du 21/11). Sur un téléphone, un formulaire long cache son bouton
 * et ses erreurs : une question par écran (règle « one thing per page »), et
 * celle-ci vient en premier parce qu'elle COMMANDE la suite — le mode décide
 * des lieux d'échange proposés à l'étape ⑥.
 *
 * « Aller simple / Aller-retour » du site n'est PAS repris, et c'est une
 * décision, pas un oubli : le mapper web envoie `returnDepartureAt: null`
 * dans les deux cas et aucun second trajet n'est créé — « Aller-retour »
 * n'ajoute qu'un mot sur la fiche du Voyageur, jamais un trajet que les
 * Expéditeurs peuvent trouver. Un contrôle qui affirme ce que le produit ne
 * fait pas est le défaut de D100 ; on ne le transpose pas. Le retour se
 * publiera comme un second trajet, ou comme une vraie fonction serveur.
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
} from '@/lib/publish-trip';

const ICONES: Record<TransportMode, keyof typeof Ionicons.glyphMap> = {
  PLANE: 'airplane-outline',
  TRAIN: 'train-outline',
  CAR: 'car-outline',
};

export default function PublishModeScreen() {
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
    router.push('/publish-trip/route');
  }, [manques.length]);

  const route =
    draft.depart !== null && draft.arrivee !== null
      ? t('bar.route', { from: draft.depart.ville, to: draft.arrivee.ville })
      : t('bar.newTrip');

  return (
    <PublishStepFrame
      title={t('mode.title')}
      subtitle={t('mode.subtitle')}
      step={1}
      valueLabel={route}
      valueHint={t('bar.gainLater')}
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
              {/* La conséquence du choix, écrite SUR le choix. Le sous-titre
                  annonce que le mode décide des lieux d'échange ; une carte
                  qui ne dit pas LESQUELS oblige à choisir pour savoir. */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.modeHint}>
                {t(`mode.${mode}_hint`)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Le sous-type n'apparaît qu'une fois le mode choisi : il n'a aucun
          sens avant, et trois paires de pastilles affichées d'avance feraient
          lire un écran deux fois plus long qu'il n'est. */}
      {draft.mode !== null ? (
        <View style={styles.group}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('mode.typeTitle')}
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
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement },
            ]}
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
  manques: {
    gap: Spacing.one,
  },
  manque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
