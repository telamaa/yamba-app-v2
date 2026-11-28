/**
 * shipments/mine.tsx — MES ENVOIS (D112).
 * =========================================
 * Le domicile de l'Expéditeur. Ce qu'il doit traiter, ce qui roule, ce qui
 * est derrière lui.
 *
 * CE LOT N'EST PAS « UNE LISTE QUI MANQUE », C'EST UNE PORTE QUI MANQUAIT.
 * Les 2 903 lignes de suivi d'envoi (`shipment/[id]`) n'étaient atteignables
 * que depuis l'écran qui suit le paiement, en `router.replace` : l'Expéditeur
 * voyait son suivi une fois, fermait l'app, et ne pouvait plus jamais y
 * revenir — ni au code de livraison, ni au rendez-vous, ni à la notation.
 *
 * TROIS SECTIONS, PAS DE FILTRE (comme « Mes trajets », D111 quinquies). Le
 * site pose quatre pastilles au-dessus d'une liste DÉJÀ sectionnée par les
 * trois mêmes groupes : taper « En cours » y affiche la section déjà
 * visible, et taper « Terminés » CACHE les deux groupes qui réclament une
 * action. On ne transpose pas.
 *
 * ET « À TRAITER » SE DÉDUIT DE CE QUE LE SERVEUR ACCORDE, pas d'une table
 * de statuts — voir `lib/mes-envois.ts`.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { mesEnvois } from '@/lib/api/shipment.api';
import {
  actionMiseEnAvant,
  compteEnCours,
  envoiDeLApi,
  grouperLesEnvois,
  type EnvoiDeLaListe,
} from '@/lib/mes-envois';
import { intlTagFor } from '@/lib/number-format';
import { formatAmountFromCents } from '@/lib/pricing-example';
import { remainingLabel, remainingUntil } from '@/lib/shipment-view';
import { formatDayMonth } from '@/lib/trip-format';

function MesEnvoisContent() {
  const t = useTranslations('myShipments');
  // Le décompte parle le dictionnaire de l'écran de suivi : un même délai
  // ne s'écrit pas de deux façons selon l'écran qui le montre.
  const tc = useTranslations('shipment');
  const locale = useLocale() as SupportedLocale;
  const tag = intlTagFor(locale);
  const theme = useTheme();
  const topInset = useTopInset();

  const [bruts, setBruts] = useState<unknown[] | null>(null);

  // À chaque RETOUR sur l'écran : on en revient après avoir confirmé une
  // réception ou noté un Voyageur, et la liste doit l'avoir vu.
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void mesEnvois().then((envois) => {
        if (vivant) setBruts(envois);
      });
      return () => {
        vivant = false;
      };
    }, [])
  );

  const envois = (bruts ?? [])
    .map(envoiDeLApi)
    .filter((envoi): envoi is EnvoiDeLaListe => envoi !== null);
  const groupes = grouperLesEnvois(envois);

  const ouvrir = useCallback((id: string) => {
    router.push({ pathname: '/shipment/[id]', params: { id } });
  }, []);

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
        ) : envois.length === 0 ? (
          <View style={styles.centre}>
            <ThemedText type="subtitle">{t('emptyTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
              {t('emptyBody')}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              // L'éditeur de recherche, pas l'accueil : quelqu'un qui n'a
              // aucun envoi cherche un trajet, il ne parcourt pas une liste.
              onPress={() => router.push('/search/edit')}
              style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}>
              <ThemedText type="smallBold" style={styles.ctaLabel}>
                {t('emptyCta')}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.liste}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('count', { count: compteEnCours(envois) })}
            </ThemedText>

            {groupes.map((groupe) => (
              <View key={groupe.section} style={styles.groupe}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t(`sections.${groupe.section}`)}
                </ThemedText>
                {groupe.envois.map((envoi) => (
                  <Carte key={envoi.id} envoi={envoi} />
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );

  function Carte({ envoi }: { envoi: EnvoiDeLaListe }) {
    const enAvant = actionMiseEnAvant(envoi);

    const route =
      envoi.depart.length > 0 && envoi.arrivee.length > 0
        ? t('route', { from: envoi.depart, to: envoi.arrivee })
        : t('noRoute');

    const quand =
      envoi.dateDepart === null
        ? t('noDate')
        : `${formatDayMonth(new Date(`${envoi.dateDepart}T12:00:00`), locale)}${
            envoi.heureDepart.length > 0 ? ` · ${envoi.heureDepart}` : ''
          }`;

    // La demande en attente est la seule qui MEURT toute seule (DEA-01) :
    // c'est la seule qui mérite un décompte. Recalculé au rendu, pas à la
    // seconde — un délai en heures n'a pas besoin d'une horloge.
    const left = envoi.expireLe ? remainingUntil(envoi.expireLe, Date.now()) : null;
    const attente = envoi.expireLe
      ? left
        ? t('expiresIn', {
            remaining: tc(`countdown.${remainingLabel(left).key}`, remainingLabel(left).values),
          })
        : t('expired')
      : null;

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => ouvrir(envoi.id)}
        style={({ pressed }) => [
          styles.carte,
          { borderColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
        ]}>
        <View style={styles.enTete}>
          <ThemedText type="smallBold" style={styles.route} numberOfLines={1}>
            {route}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t(`status.${envoi.statut}`)}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {quand}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {envoi.voyageur.length > 0 ? t('carrier', { name: envoi.voyageur }) : t('noCarrier')}
          {envoi.totalCents === null
            ? ''
            : ` · ${formatAmountFromCents(envoi.totalCents, tag)} ${envoi.devise === 'EUR' ? '€' : envoi.devise}`}
        </ThemedText>

        {attente === null ? null : (
          <ThemedText type="small" themeColor="textSecondary">
            {attente}
          </ThemedText>
        )}

        {enAvant === null ? null : (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                enAvant === 'noter'
                  ? router.push({ pathname: '/shipment/[id]/rate', params: { id: envoi.id } })
                  : ouvrir(envoi.id)
              }
              style={({ pressed }) => [
                styles.bouton,
                { borderColor: Brand.mango, opacity: pressed ? 0.7 : 1 },
              ]}>
              <ThemedText type="smallBold">{t(`actions.${enAvant}`)}</ThemedText>
            </Pressable>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
        )}
      </Pressable>
    );
  }
}

export default function MesEnvoisScreen() {
  return (
    // Écran POUSSÉ derrière la porte : il lui passe sa sortie (D104).
    <IdentityGate destination="activity" onDismiss={() => router.back()}>
      <MesEnvoisContent />
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
  centreTexte: {
    textAlign: 'center',
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
