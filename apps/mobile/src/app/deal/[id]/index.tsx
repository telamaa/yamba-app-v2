/**
 * deal/[id].tsx — LA DEMANDE, ET LES DEUX RÉPONSES (D113).
 * ==========================================================
 * On n'accepte pas depuis une ligne de liste. Accepter, c'est s'engager à
 * transporter le colis de quelqu'un ET déclencher le DÉBIT de l'Expéditeur
 * (capture manuelle, D39) : il faut avoir vu ce qu'on accepte.
 *
 * REFUSER CONFIRME, ACCEPTER NON — et l'asymétrie est raisonnée. Cet écran
 * EST la délibération d'une acceptation : y ajouter une alerte ferait
 * répéter une décision déjà prise, écran en main. Le refus, lui, est
 * terminal pour l'Expéditeur et se tape vite pour « faire de la place ». En
 * revanche l'acceptation DIT ce qu'elle engage, en toutes lettres, juste
 * au-dessus du bouton.
 *
 * LE GAIN, JAMAIS LE TOTAL : la vue Voyageur ne porte que `transportCents`
 * (A13). Cet écran ne recompose aucun total — ce qu'il ne reçoit pas, il ne
 * l'invente pas.
 *
 * LE DESTINATAIRE N'EST PAS ICI, et ce n'est pas l'app qui le décide :
 * `recipientForCarrier` minimise côté serveur (nom à l'acceptation,
 * téléphone à la prise en charge, jamais l'email — ANO-API-15).
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BackButton } from '@/components/back-button';
import { IdentityGate } from '@/components/identity-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTopInset } from '@/hooks/use-top-inset';
import {
  MauvaisRoleError,
  accepterLaDemande,
  laDemande,
  refuserLaDemande,
} from '@/lib/api/my-deals.api';
import { demandeDeLApi, peut, type DemandeDeLaListe } from '@/lib/mes-demandes';
import { useActivite } from '@/lib/activite-context';
import { intlTagFor } from '@/lib/number-format';
import { formatMoneyFromCents } from '@/lib/pricing-example';
import { formatDayMonth } from '@/lib/trip-format';

type Etat =
  | { phase: 'chargement' }
  | { phase: 'erreur'; mauvaisRole: boolean }
  | { phase: 'prete'; demande: DemandeDeLaListe; brut: Record<string, unknown> };

function DemandeContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('myDeals');
  const tMessagerie = useTranslations('messaging');
  const { conversations, rafraichir } = useActivite();
  const locale = useLocale() as SupportedLocale;
  const tag = intlTagFor(locale);

  // Le fil de CE deal, s'il existe. `bookingId` est la clé : l'écran
  // connaît une demande, pas une conversation.
  const conversation = conversations.find((c) => c.bookingId === id);
  const theme = useTheme();
  const topInset = useTopInset();

  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });
  const [occupe, setOccupe] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void laDemande(id ?? '')
        .then((brut) => {
          if (!vivant) return;
          const demande = demandeDeLApi(brut);
          setEtat(
            demande === null
              ? { phase: 'erreur', mauvaisRole: false }
              : { phase: 'prete', demande, brut: brut as Record<string, unknown> }
          );
        })
        .catch((erreur) => {
          if (vivant)
            setEtat({ phase: 'erreur', mauvaisRole: erreur instanceof MauvaisRoleError });
        });
      return () => {
        vivant = false;
      };
    }, [id])
  );

  /** Une réponse. Elle JETTE, et son refus se montre. */
  const repondre = useCallback(
    async (geste: () => Promise<unknown>, message: string) => {
      setOccupe(true);
      try {
        await geste();
        // ACCEPTER fait NAÎTRE une conversation (D61) : le contexte doit
        // l'apprendre maintenant, sans quoi la porte vers le fil
        // n'apparaîtrait qu'au prochain passage au premier plan.
        void rafraichir();
        // On REVIENT à la liste : la décision est prise, et la liste la
        // reflétera (elle relit à chaque retour). Rester sur une demande
        // qu'on vient de trancher n'a rien à proposer.
        Alert.alert(t('detail.title'), message);
        router.back();
      } catch {
        Alert.alert(t('detail.title'), t('detail.failed'));
      } finally {
        setOccupe(false);
      }
    },
    [t, rafraichir]
  );

  const entete = (
    <View
      style={[
        styles.header,
        { borderBottomColor: theme.backgroundElement, paddingTop: topInset + Spacing.two },
      ]}>
      <BackButton label={t('back')} onPress={() => router.back()} />
      <ThemedText type="subtitle" style={styles.titre}>
        {t('detail.title')}
      </ThemedText>
    </View>
  );

  if (etat.phase !== 'prete') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.column} edges={['left', 'right']}>
          {entete}
          <View style={styles.centre}>
            {etat.phase === 'chargement' ? (
              <ActivityIndicator color={Brand.mango} />
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
                {etat.mauvaisRole ? t('detail.wrongRole') : t('detail.loadError')}
              </ThemedText>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { demande, brut } = etat;
  const parcel = (brut.parcel ?? {}) as Record<string, unknown>;
  const lieu = (cle: string) => {
    const place = brut[cle] as { details?: string | null } | null | undefined;
    const details = typeof place?.details === 'string' ? place.details.trim() : '';
    return details.length > 0 ? details : t('detail.placeFree');
  };

  const quand =
    demande.dateDepart === null
      ? t('noDate')
      : `${formatDayMonth(new Date(`${demande.dateDepart}T12:00:00`), locale)}${
          demande.heureDepart.length > 0 ? ` · ${demande.heureDepart}` : ''
        }`;

  const valeur =
    typeof parcel.declaredValueCents === 'number' && Number.isFinite(parcel.declaredValueCents)
      ? t('detail.declaredValue', {
          amount: formatMoneyFromCents(parcel.declaredValueCents, tag),
        })
      : null;
  const description = typeof parcel.description === 'string' ? parcel.description.trim() : '';

  const peutRepondre = peut(demande, 'accept');
  // LA PORTE vers l'inspection (D115). Elle n'est pas déduite d'un statut :
  // seule la machine à états sait si la fenêtre est ouverte.
  const peutPrendreEnCharge = peut(demande, 'pickup');
  // LA PORTE vers la remise (D116). Même règle : le serveur seul sait si le
  // colis est en transit et si le verrou de saisie est levé.
  const peutRemettre = peut(demande, 'deliver');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.column} edges={['left', 'right']}>
        {entete}

        <ScrollView contentContainerStyle={styles.corps}>
          <Section titre={t('detail.parcelTitle')} theme={theme}>
            <ThemedText type="smallBold">
              {motDuColis(demande.colis, t)}
              {demande.poidsKg === null ? '' : ` · ${demande.poidsKg} kg`}
            </ThemedText>
            {valeur !== null && (
              <ThemedText type="small" themeColor="textSecondary">
                {valeur}
              </ThemedText>
            )}
            {description.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {description}
              </ThemedText>
            )}
          </Section>

          <Section titre={t('detail.shipperTitle')} theme={theme}>
            <ThemedText type="smallBold">
              {demande.expediteur.length > 0 ? demande.expediteur : t('noShipper')}
            </ThemedText>
          </Section>

          <Section titre={t('detail.tripTitle')} theme={theme}>
            <ThemedText type="smallBold">
              {demande.depart.length > 0 && demande.arrivee.length > 0
                ? t('route', { from: demande.depart, to: demande.arrivee })
                : t('noRoute')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {quand}
            </ThemedText>
          </Section>

          <Section titre={t('detail.placesTitle')} theme={theme}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('detail.pickupPlace')} · {lieu('pickupPlace')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('detail.deliveryPlace')} · {lieu('deliveryPlace')}
            </ThemedText>
          </Section>

          <Section titre={t('detail.gainTitle')} theme={theme}>
            <ThemedText type="title" style={styles.gain}>
              {demande.gainCents === null
                ? t('noGain')
                : formatMoneyFromCents(demande.gainCents, tag)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('detail.gainNote')}
            </ThemedText>
          </Section>

          {/* D117 — la porte vers le fil. Elle n'apparaît QUE si une
              conversation existe : un fil naît à l'acceptation (D61), donc
              une demande en attente n'en a pas, et un bouton qui mène à
              rien est pire qu'un bouton absent.

              La conversation se trouve dans le contexte d'activité, qui la
              porte déjà (D117 0A) : aucune requête de plus pour ouvrir une
              porte qu'on ne franchira peut-être pas. */}
          {conversation !== undefined && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/conversation/[id]', params: { id: conversation.id } })
              }
              style={({ pressed }) => [
                styles.secondaire,
                styles.porteDuFil,
                { borderColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
              ]}>
              <Ionicons name="chatbubble-outline" size={16} color={theme.text} />
              <ThemedText type="smallBold">
                {tMessagerie('entry.open', { name: conversation.interlocuteur.prenom })}
              </ThemedText>
              {conversation.nonLus > 0 ? (
                <View style={[styles.pastilleNonLus, { backgroundColor: Brand.mango }]}>
                  <ThemedText type="small" style={styles.pastilleTexte}>
                    {conversation.nonLus.toLocaleString(tag)}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          )}

          {peutPrendreEnCharge && (
            <View style={styles.reponses}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('detail.pickupCtaWhy')}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/deal/[id]/pickup', params: { id: demande.id } })
                }
                style={({ pressed }) => [styles.principal, { opacity: pressed ? 0.85 : 1 }]}>
                <ThemedText type="smallBold" style={styles.principalLabel}>
                  {t('detail.pickupCta')}
                </ThemedText>
              </Pressable>
            </View>
          )}

          {peutRemettre && (
            <View style={styles.reponses}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('detail.deliverCtaWhy')}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/deal/[id]/deliver', params: { id: demande.id } })
                }
                style={({ pressed }) => [styles.principal, { opacity: pressed ? 0.85 : 1 }]}>
                <ThemedText type="smallBold" style={styles.principalLabel}>
                  {t('detail.deliverCta')}
                </ThemedText>
              </Pressable>
            </View>
          )}

          {peutRepondre && (
            <View style={styles.reponses}>
              {/* L'engagement est DIT, juste au-dessus du bouton. C'est ce
                  qui remplace une alerte de confirmation. */}
              <ThemedText type="small" themeColor="textSecondary">
                {t('detail.commitment')}
              </ThemedText>

              {occupe ? (
                <ActivityIndicator color={Brand.mango} />
              ) : (
                <View style={styles.boutons}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      void repondre(() => accepterLaDemande(demande.id), t('detail.accepted'))
                    }
                    style={({ pressed }) => [
                      styles.principal,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}>
                    <ThemedText type="smallBold" style={styles.principalLabel}>
                      {t('detail.accept')}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      Alert.alert(t('detail.declineTitle'), t('detail.declineBody'), [
                        { text: t('detail.keep'), style: 'cancel' },
                        {
                          text: t('detail.declineOk'),
                          style: 'destructive',
                          onPress: () =>
                            void repondre(
                              () => refuserLaDemande(demande.id),
                              t('detail.declined')
                            ),
                        },
                      ])
                    }
                    style={({ pressed }) => [
                      styles.secondaire,
                      { borderColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('detail.decline')}
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({
  titre,
  theme,
  children,
}: {
  titre: string;
  theme: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { borderColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {titre}
      </ThemedText>
      {children}
    </View>
  );
}

export default function DemandeScreen() {
  return (
    <IdentityGate destination="activity" onDismiss={() => router.back()}>
      <DemandeContent />
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
    padding: Spacing.five,
  },
  centreTexte: { textAlign: 'center' },
  corps: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  gain: { fontSize: 28 },
  reponses: { gap: Spacing.three, marginTop: Spacing.two },
  boutons: { gap: Spacing.two },
  principal: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principalLabel: { color: '#1A1A1A', fontSize: 15 },
  secondaire: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  porteDuFil: { flexDirection: 'row', gap: Spacing.two },
  pastilleNonLus: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleTexte: { color: '#1A1A1A', fontFamily: Font.bold },
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
