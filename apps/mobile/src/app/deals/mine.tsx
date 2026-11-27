/**
 * deals/mine.tsx — LES DEMANDES REÇUES (D113).
 * ==============================================
 * Le Voyageur n'avait aucun écran natif : `GET /me/deals` n'était appelé que
 * pour COMPTER un badge sur l'onglet Activité. Troisième porte manquante en
 * trois jours — et la plus chère : une demande MEURT en 24 h (DEA-01), et
 * l'Expéditeur sans réponse ne perd pas un écran vide, il perd son colis.
 *
 * CETTE LISTE NE SAIT PAS RÉPONDRE, ET C'EST VOULU. Accepter engage le
 * Voyageur ET déclenche le débit de l'Expéditeur (D39) : il faut avoir vu le
 * colis, sa valeur, l'Expéditeur, le lieu et le gain. Les deux réponses
 * vivent sur l'écran de la demande ; ici on mène, on ne tranche pas.
 *
 * LE TRI SUIT L'HORLOGE, pas la création : « À répondre » est triée par
 * échéance croissante. C'est la seule liste de l'app où attendre coûte
 * quelque chose à quelqu'un d'autre.
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
import { mesDemandes } from '@/lib/api/my-deals.api';
import {
  compteARepondre,
  demandeDeLApi,
  grouperLesDemandes,
  urgenceDeLaDemande,
  type DemandeDeLaListe,
} from '@/lib/mes-demandes';
import { intlTagFor } from '@/lib/number-format';
import { formatAmountFromCents } from '@/lib/pricing-example';
import { remainingLabel, remainingUntil } from '@/lib/shipment-view';
import { formatDayMonth } from '@/lib/trip-format';

function MesDemandesContent() {
  const t = useTranslations('myDeals');
  const tc = useTranslations('shipment');
  const locale = useLocale() as SupportedLocale;
  const tag = intlTagFor(locale);
  const theme = useTheme();
  const topInset = useTopInset();

  const [bruts, setBruts] = useState<unknown[] | null>(null);

  // À chaque RETOUR : on en revient après avoir accepté ou refusé.
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void mesDemandes().then((demandes) => {
        if (vivant) setBruts(demandes);
      });
      return () => {
        vivant = false;
      };
    }, [])
  );

  const demandes = (bruts ?? [])
    .map(demandeDeLApi)
    .filter((demande): demande is DemandeDeLaListe => demande !== null);
  const groupes = grouperLesDemandes(demandes);

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
        ) : demandes.length === 0 ? (
          <View style={styles.centre}>
            <ThemedText type="subtitle">{t('emptyTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
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
              {t('count', { count: compteARepondre(demandes) })}
            </ThemedText>

            {groupes.map((groupe) => (
              <View key={groupe.section} style={styles.groupe}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t(`sections.${groupe.section}`)}
                </ThemedText>
                {groupe.demandes.map((demande) => (
                  <Carte key={demande.id} demande={demande} />
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );

  function Carte({ demande }: { demande: DemandeDeLaListe }) {
    const route =
      demande.depart.length > 0 && demande.arrivee.length > 0
        ? t('route', { from: demande.depart, to: demande.arrivee })
        : t('noRoute');

    const quand =
      demande.dateDepart === null
        ? t('noDate')
        : `${formatDayMonth(new Date(`${demande.dateDepart}T12:00:00`), locale)}${
            demande.heureDepart.length > 0 ? ` · ${demande.heureDepart}` : ''
          }`;

    // Recalculé au rendu, pas à la seconde : un délai en heures n'a pas
    // besoin d'une horloge, et une horloge réveille l'écran pour rien.
    const maintenant = Date.now();
    const urgence = urgenceDeLaDemande(demande, maintenant);
    const left = demande.expireLe ? remainingUntil(demande.expireLe, maintenant) : null;
    const delai = left
      ? tc(`countdown.${remainingLabel(left).key}`, remainingLabel(left).values)
      : null;

    const mot = motDuColis(demande.colis, t);
    const colis =
      demande.poidsKg === null
        ? t('parcelNoWeight', { family: mot })
        : t('parcel', { family: mot, weight: demande.poidsKg });

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/deal/[id]', params: { id: demande.id } })}
        style={({ pressed }) => [
          styles.carte,
          { borderColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
          // L'urgence se marque d'UN liseré, pas d'une couleur de fond :
          // une carte peinte en orange crie, et dix cartes qui crient ne
          // disent plus rien.
          urgence === 'bientot' && { borderColor: Brand.mango, borderLeftWidth: 3 },
        ]}>
        <View style={styles.enTete}>
          <ThemedText type="smallBold" style={styles.route} numberOfLines={1}>
            {route}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t(`status.${demande.statut}`)}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {quand}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {colis}
          {' · '}
          {demande.expediteur.length > 0
            ? t('shipper', { name: demande.expediteur })
            : t('noShipper')}
        </ThemedText>

        <ThemedText type="smallBold">
          {demande.gainCents === null
            ? t('noGain')
            : t('gain', { amount: `${formatAmountFromCents(demande.gainCents, tag)} €` })}
        </ThemedText>

        {urgence !== null && delai !== null ? (
          <View style={styles.horloge}>
            <Ionicons
              name="time-outline"
              size={14}
              color={urgence === 'calme' ? theme.textSecondary : Brand.mango}
            />
            <ThemedText
              type="small"
              themeColor={urgence === 'calme' ? 'textSecondary' : undefined}
              style={urgence === 'calme' ? undefined : { color: Brand.mango }}>
              {t(`urgency.${urgence}`, { remaining: delai })}
            </ThemedText>
          </View>
        ) : demande.statut === 'EXPIRED' ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('expired')}
          </ThemedText>
        ) : null}
      </Pressable>
    );
  }
}

export default function MesDemandesScreen() {
  return (
    <IdentityGate destination="activity" onDismiss={() => router.back()}>
      <MesDemandesContent />
    </IdentityGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  column: { flex: 1, maxWidth: MaxContentWidth },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titre: { fontSize: 20 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  centreTexte: { textAlign: 'center' },
  liste: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  groupe: { gap: Spacing.two },
  carte: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  enTete: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  route: { flex: 1, minWidth: 0 },
  badge: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  horloge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: '#1A1A1A', fontSize: 15 },
});

/**
 * Le mot qui décrit le colis. Deux dictionnaires, parce que deux
 * populations cohabitent en base (D113) — et une clé CALCULÉE, donc un
 * angle mort que ni `tsc` ni le contrôle i18n de la CI ne voit : une fiche
 * vérifie que chaque code a son entrée dans les DEUX langues (leçon D83,
 * où une clé absente faisait lire le CHEMIN de la clé à l'utilisateur).
 */
function motDuColis(
  colis: DemandeDeLaListe['colis'],
  t: (cle: string) => string
): string {
  if (colis === null) return t('noParcel');
  return t(`${colis.source === 'famille' ? 'families' : 'categories'}.${colis.code}`);
}
