/**
 * trips/mine.tsx — MES TRAJETS (D111 quinquies).
 * ================================================
 * Le domicile du Voyageur : ce qu'il a en ligne, ce qu'il n'a pas fini, ce
 * qui est passé. C'est la page que le brouillon serveur (D111 quater)
 * rendait nécessaire — le seuil de publication ne proposait que le brouillon
 * le PLUS RÉCENT, ce qui suffit tant qu'on en a un, pas quand on en a trois.
 *
 * TROIS SECTIONS, PAS DE FILTRE. Des pastilles de filtre donneraient un
 * écran VIDE dès qu'on en tape une qui ne correspond à rien, et un écran
 * vide qu'on a provoqué soi-même se lit comme une panne. Les sections
 * montrent tout d'un coup d'œil, et celles qui n'ont rien disparaissent.
 *
 * UNE ACTION PAR CARTE, celle qui fait AVANCER le trajet (finir un
 * brouillon, remettre en ligne une pause). Les gestes qui défont — annuler,
 * supprimer — sont en second et DEMANDENT CONFIRMATION : ils retirent une
 * annonce que des Expéditeurs ont peut-être déjà repérée.
 *
 * ET L'APP NE DÉCIDE RIEN. Chaque trajet arrive avec ses `allowedActions`,
 * calculées par la machine à états du serveur, qui connaît les réservations
 * en cours. Un bouton n'apparaît que si le serveur l'autorise — sinon on
 * promettrait un geste qu'il refusera (D72).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BackButton } from '@/components/back-button';
import { IdentityGate } from '@/components/identity-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTopInset } from '@/hooks/use-top-inset';
import { ApiError } from '@/lib/api/client';
import {
  annulerLeTrajet,
  mesTrajets,
  mettreEnPause,
  remettreEnLigne,
  restaurerLeTrajet,
} from '@/lib/api/my-trips.api';
import { supprimerLeBrouillon } from '@/lib/api/publish.api';
import {
  actionMiseEnAvant,
  compteEnCours,
  grouperLesTrajets,
  peut,
  trajetDeLApi,
  type TrajetDeLaListe,
} from '@/lib/mes-trajets';
import { intlTagFor } from '@/lib/number-format';
import { formatPerKg } from '@/lib/pricing-example';
import { remplacerLeBrouillon } from '@/lib/publish-draft';
import { brouillonDepuisLeTrajet } from '@/lib/publish-reverse';
import { formatDayMonth } from '@/lib/trip-format';

function MesTrajetsContent() {
  const t = useTranslations('myTrips');
  const locale = useLocale() as SupportedLocale;
  const tag = intlTagFor(locale);
  const theme = useTheme();
  const topInset = useTopInset();

  const [bruts, setBruts] = useState<Record<string, unknown>[] | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    const trajets = await mesTrajets();
    setBruts(trajets as Record<string, unknown>[]);
  }, []);

  // À chaque RETOUR sur l'écran, pas au seul montage : on en revient après
  // avoir publié, repris ou supprimé un trajet.
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void mesTrajets().then((trajets) => {
        if (vivant) setBruts(trajets as Record<string, unknown>[]);
      });
      return () => {
        vivant = false;
      };
    }, [])
  );

  const trajets = (bruts ?? [])
    .map(trajetDeLApi)
    .filter((trajet): trajet is TrajetDeLaListe => trajet !== null);
  const groupes = grouperLesTrajets(trajets);

  /** Un geste de cycle de vie : il JETTE, et son refus se montre. */
  const agir = useCallback(
    async (trajet: TrajetDeLaListe, geste: () => Promise<unknown>) => {
      setOccupe(trajet.id);
      try {
        await geste();
        await recharger();
      } catch (erreur) {
        const code = erreur instanceof ApiError ? erreur.code : null;
        Alert.alert(
          t('title'),
          code === 'TRIP_HAS_ACTIVE_DEALS' ? t('failedDeals') : t('failed')
        );
      } finally {
        setOccupe(null);
      }
    },
    [recharger, t]
  );

  const continuer = useCallback((trajet: Record<string, unknown>) => {
    // Le même mapper que la reprise d'un brouillon depuis le seuil : une
    // seule relecture dans l'app, pas deux (D111 quater).
    remplacerLeBrouillon(brouillonDepuisLeTrajet(trajet));
    router.push('/publish-trip');
  }, []);

  const confirmer = useCallback(
    (titre: string, corps: string, confirmer: string, action: () => void) => {
      Alert.alert(titre, corps, [
        { text: t('keep'), style: 'cancel' },
        { text: confirmer, style: 'destructive', onPress: action },
      ]);
    },
    [t]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.column} edges={['left', 'right']}>
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.backgroundElement, paddingTop: topInset + Spacing.two },
          ]}>
          <BackButton label={t('back')} onPress={() => router.back()} />
          <ThemedText type="subtitle" style={styles.titre}>
            {t('title')}
          </ThemedText>
        </View>

        {bruts === null ? (
          <View style={styles.centre}>
            <ActivityIndicator color={Brand.mango} />
          </View>
        ) : trajets.length === 0 ? (
          <View style={styles.centre}>
            <ThemedText type="subtitle">{t('emptyTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('emptyBody')}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/publish-trip')}
              style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}>
              <ThemedText type="smallBold" style={styles.ctaLabel}>
                {t('emptyCta')}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.liste}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('count', { count: compteEnCours(trajets) })}
            </ThemedText>

            {groupes.map((groupe) => (
              <View key={groupe.section} style={styles.groupe}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t(`sections.${groupe.section}`)}
                </ThemedText>
                {groupe.trajets.map((trajet) => (
                  <Carte key={trajet.id} trajet={trajet} />
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );

  function Carte({ trajet }: { trajet: TrajetDeLaListe }) {
    const enAvant = actionMiseEnAvant(trajet);
    const enCours = occupe === trajet.id;
    const brut = (bruts ?? []).find((t) => t.id === trajet.id) ?? {};

    const route =
      trajet.depart.length > 0 && trajet.arrivee.length > 0
        ? t('route', { from: trajet.depart, to: trajet.arrivee })
        : t('noRoute');

    const quand =
      trajet.dateDepart === null
        ? t('noDate')
        : `${formatDayMonth(new Date(`${trajet.dateDepart}T12:00:00`), locale)}${
            trajet.heureDepart.length > 0 ? ` · ${trajet.heureDepart}` : ''
          }`;

    return (
      <View style={[styles.carte, { borderColor: theme.backgroundElement }]}>
        <View style={styles.enTete}>
          <ThemedText type="smallBold" style={styles.route} numberOfLines={1}>
            {route}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t(`status.${trajet.statut}`)}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {quand}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {trajet.prixParKiloCents === null || trajet.capaciteKg === null
            ? t('offerMissing')
            : t('offer', {
                price: formatPerKg(trajet.prixParKiloCents / 100, tag),
                capacity: trajet.capaciteKg,
              })}
        </ThemedText>

        <View style={styles.actions}>
          {enCours ? <ActivityIndicator size="small" color={Brand.mango} /> : null}

          {enAvant === 'continuer' && !enCours ? (
            <Bouton label={t('actions.continuer')} principal onPressAction={() => continuer(brut)} />
          ) : null}
          {enAvant === 'pause' && !enCours ? (
            <Bouton
              label={t('actions.pause')}
              principal
              onPressAction={() => void agir(trajet, () => mettreEnPause(trajet.id))}
            />
          ) : null}
          {enAvant === 'remettre' && !enCours ? (
            <Bouton
              label={t('actions.remettre')}
              principal
              onPressAction={() => void agir(trajet, () => remettreEnLigne(trajet.id))}
            />
          ) : null}
          {enAvant === 'restaurer' && !enCours ? (
            <Bouton
              label={t('actions.restaurer')}
              principal
              onPressAction={() => void agir(trajet, () => restaurerLeTrajet(trajet.id))}
            />
          ) : null}

          {/* Les gestes qui DÉFONT : en second, et confirmés. */}
          {peut(trajet, 'viewPublic') && !enCours ? (
            <Bouton
              label={t('actions.voir')}
              onPressAction={() =>
                router.push({ pathname: '/trip/[id]', params: { id: trajet.id } })
              }
            />
          ) : null}
          {peut(trajet, 'cancel') && !enCours ? (
            <Bouton
              label={t('actions.annuler')}
              onPressAction={() =>
                confirmer(
                  t('confirmCancelTitle'),
                  t('confirmCancelBody'),
                  t('confirmCancelOk'),
                  () => void agir(trajet, () => annulerLeTrajet(trajet.id))
                )
              }
            />
          ) : null}
          {peut(trajet, 'delete') && trajet.statut === 'DRAFT' && !enCours ? (
            <Bouton
              label={t('actions.supprimer')}
              onPressAction={() =>
                confirmer(
                  t('confirmDeleteTitle'),
                  t('confirmDeleteBody'),
                  t('confirmDeleteOk'),
                  () =>
                    void agir(trajet, async () => {
                      await supprimerLeBrouillon(trajet.id);
                    })
                )
              }
            />
          ) : null}
        </View>
      </View>
    );
  }

  function Bouton({
    label,
    principal,
    onPressAction,
  }: {
    label: string;
    principal?: boolean;
    onPressAction: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPressAction}
        style={({ pressed }) => [
          styles.bouton,
          {
            borderColor: principal ? Brand.mango : theme.backgroundElement,
            backgroundColor: principal ? theme.backgroundElement : 'transparent',
            opacity: pressed ? 0.7 : 1,
          },
        ]}>
        <ThemedText type={principal ? 'smallBold' : 'small'} themeColor={principal ? undefined : 'textSecondary'}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }
}

export default function MesTrajetsScreen() {
  return (
    // Écran POUSSÉ derrière la porte : il lui passe sa sortie (D104).
    <IdentityGate destination="activity" onDismiss={() => router.back()}>
      <MesTrajetsContent />
    </IdentityGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  column: {
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
  titre: {
    fontSize: 20,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  liste: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  groupe: {
    gap: Spacing.two,
  },
  carte: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  enTete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  route: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  bouton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: '#1A1A1A',
    fontSize: 15,
  },
});
