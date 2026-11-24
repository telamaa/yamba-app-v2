/**
 * publish-trip/places.tsx — ⑥ OÙ SE FAIT L'ÉCHANGE (phase « Conditions »)
 * ========================================================================
 * Le Voyageur dit où on lui REMET le colis au départ, et où on le RÉCUPÈRE à
 * l'arrivée. C'est l'écran jumeau de `booking/places.tsx` côté Expéditeur,
 * qui lit ces mêmes cartes pour en choisir une — d'où la même grammaire :
 * une carte bordée par lieu, la ligne entière cliquable, rien à viser.
 *
 * TROIS CHOSES QUE LE SITE NE FAIT PAS.
 *
 * ① Les souplesses dépendent du LIEU (`flexibilitesPour`). Le site propose
 *    les cinq partout : « exact » sur une zone de ville ne veut rien dire
 *    (une zone n'a pas de point), et « toute la ville » sur un aéroport non
 *    plus. Un choix qui ne veut rien dire se choisit quand même.
 *
 * ② Les titres nomment les VILLES du trajet (« À Paris, on te remet le
 *    colis ») : les deux groupes sont autrement indiscernables, et c'est
 *    l'erreur la plus facile à commettre ici — régler l'arrivée en croyant
 *    régler le départ.
 *
 * ③ Un lieu ÉTEINT garde ses précisions. Rallumer ne doit pas faire
 *    retaper ce qu'on avait écrit (le brouillon garde les cartes éteintes,
 *    `lieuxParDefaut`).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import { PublishStepFrame } from '@/components/publish/publish-step-frame';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { intlTagFor } from '@/lib/number-format';
import { formatAmountFromCents } from '@/lib/pricing-example';
import { setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import { gainSiToutPartCents } from '@/lib/publish-pricing';
import {
  flexibilitesPour,
  lieuxParDefaut,
  manquesLieux,
  memeFlexibilite,
  type LieuBrouillon,
} from '@/lib/publish-trip';

export default function PublishPlacesScreen() {
  const t = useTranslations('publish');
  const locale = useLocale();
  const tag = intlTagFor(locale);
  const theme = useTheme();
  const draft = usePublishDraft();
  const [montreLesManques, setMontreLesManques] = useState(false);

  const manques = manquesLieux(draft);

  /**
   * LES CARTES VIENNENT DU MODE, et le mode est choisi à l'écran ①.
   *
   * Dans le tunnel, `choisirMode` les a déjà posées. Mais un écran qui PEUT
   * se rendre vide doit savoir quoi dire : arrivé ici sans mode (lien
   * profond, brouillon effacé d'un autre écran), le premier jet affichait
   * deux titres et RIEN — un écran vide qui ne dit pas pourquoi il est vide.
   * On repose donc les cartes si le mode est connu, et sinon on le DIT, avec
   * la porte pour y aller.
   */
  useEffect(() => {
    if (draft.mode === null) return;
    const valeurs: { lieuxRemise?: LieuBrouillon[]; lieuxLivraison?: LieuBrouillon[] } = {};
    if (draft.lieuxRemise.length === 0) valeurs.lieuxRemise = lieuxParDefaut(draft.mode);
    if (draft.lieuxLivraison.length === 0) valeurs.lieuxLivraison = lieuxParDefaut(draft.mode);
    if (Object.keys(valeurs).length > 0) setPublishDraft(valeurs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.mode]);

  const onContinue = useCallback(() => {
    if (manques.length > 0) {
      setMontreLesManques(true);
      return;
    }
    setMontreLesManques(false);
    router.push('/publish-trip/review');
  }, [manques.length]);

  const modifier = useCallback(
    (contexte: 'lieuxRemise' | 'lieuxLivraison', index: number, patch: Partial<LieuBrouillon>) => {
      const liste = draft[contexte].map((lieu, rang) => (rang === index ? { ...lieu, ...patch } : lieu));
      setPublishDraft({ [contexte]: liste } as Partial<typeof draft>);
    },
    [draft]
  );

  const gainCents = gainSiToutPartCents(draft.prixParKiloEur, draft.capaciteKg);

  return (
    <PublishStepFrame
      title={t('places.title')}
      subtitle={t('places.subtitle')}
      step={6}
      valueLabel={
        gainCents === null ? t('bar.newTrip') : `${formatAmountFromCents(gainCents, tag)} €`
      }
      valueHint={gainCents === null ? t('bar.gainLater') : t('price.gainBarHint')}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      <Groupe
        titre={
          draft.depart === null
            ? t('places.pickupTitleFallback')
            : t('places.pickupTitle', { city: draft.depart.ville })
        }
        lieux={draft.lieuxRemise}
        contexte="lieuxRemise"
        manque={montreLesManques && manques.includes('lieuRemise')}
        messageDeManque={t('missing.lieuRemise')}
      />

      <Groupe
        titre={
          draft.arrivee === null
            ? t('places.deliveryTitleFallback')
            : t('places.deliveryTitle', { city: draft.arrivee.ville })
        }
        lieux={draft.lieuxLivraison}
        contexte="lieuxLivraison"
        manque={montreLesManques && manques.includes('lieuLivraison')}
        messageDeManque={t('missing.lieuLivraison')}
      />
    </PublishStepFrame>
  );

  function Groupe({
    titre,
    lieux,
    contexte,
    manque,
    messageDeManque,
  }: {
    titre: string;
    lieux: LieuBrouillon[];
    contexte: 'lieuxRemise' | 'lieuxLivraison';
    manque: boolean;
    messageDeManque: string;
  }) {
    return (
      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {titre}
        </ThemedText>
        {lieux.length === 0 ? (
          <View style={[styles.carte, { borderColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('places.noMode')}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.dismissTo('/publish-trip')}
              hitSlop={8}
              style={styles.lienVersLeMode}>
              <ThemedText type="smallBold" style={{ color: Brand.mango }}>
                {t('places.noModeCta')}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          lieux.map((lieu, index) => (
            <Carte
              key={`${lieu.kind}-${index}`}
              lieu={lieu}
              onChangeAction={(patch) => modifier(contexte, index, patch)}
            />
          ))
        )}
        {manque ? (
          <View style={styles.manque}>
            <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
            <ThemedText type="small" style={{ color: Brand.mango }}>
              {messageDeManque}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  }

  function Carte({
    lieu,
    onChangeAction,
  }: {
    lieu: LieuBrouillon;
    onChangeAction: (patch: Partial<LieuBrouillon>) => void;
  }) {
    const nom = t(`places.${lieu.kind}`);
    return (
      <View
        style={[
          styles.carte,
          { borderColor: lieu.actif ? Brand.mango : theme.backgroundElement },
        ]}>
        <View style={styles.entete}>
          <Ionicons
            name={lieu.kind === 'CITY_AREA' ? 'business-outline' : lieu.kind === 'AIRPORT' ? 'airplane-outline' : 'train-outline'}
            size={18}
            color={lieu.actif ? Brand.mango : theme.textSecondary}
          />
          <ThemedText type="smallBold" style={styles.enteteTexte}>
            {nom}
          </ThemedText>
          <Switch
            value={lieu.actif}
            onValueChange={(actif) => onChangeAction({ actif })}
            trackColor={{ true: Brand.mango, false: theme.backgroundSelected }}
            accessibilityLabel={`${t('places.enable')} — ${nom}`}
          />
        </View>

        {/* Éteint, la carte se tait : ses réglages ne concernent personne tant
            qu'elle n'est pas proposée. Ses valeurs, elles, sont gardées. */}
        {lieu.actif ? (
          <>
            <TextInput
              style={[styles.details, { color: theme.text, borderColor: theme.backgroundElement }]}
              value={lieu.details}
              onChangeText={(details) => onChangeAction({ details })}
              placeholder={t('places.detailsPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={`${nom} — ${t('places.detailsPlaceholder')}`}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {t('places.flexibility')}
            </ThemedText>
            <View style={styles.chips}>
              {flexibilitesPour(lieu.kind).map((option) => {
                const actif = memeFlexibilite(option, lieu);
                const libelle =
                  option.flexibility === 'RADIUS'
                    ? t('places.RADIUS', { km: option.radiusKm ?? 0 })
                    : t(`places.${option.flexibility}`);
                return (
                  <Pressable
                    key={`${option.flexibility}-${option.radiusKm ?? 0}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif }}
                    accessibilityLabel={`${nom} — ${libelle}`}
                    onPress={() =>
                      onChangeAction({
                        flexibility: option.flexibility,
                        radiusKm: option.radiusKm,
                      })
                    }
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        borderColor: actif ? Brand.mango : theme.backgroundElement,
                        backgroundColor: actif ? theme.backgroundElement : 'transparent',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}>
                    <ThemedText type={actif ? 'smallBold' : 'small'}>{libelle}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  carte: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  enteteTexte: {
    flex: 1,
    minWidth: 0,
  },
  details: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    fontSize: 15,
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
  lienVersLeMode: {
    minHeight: 44,
    justifyContent: 'center',
  },
  manque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
