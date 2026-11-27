/**
 * activity.tsx — l'onglet « Activité » (ex-« Trajets », A210).
 * ============================================================
 * Il sert les DEUX faces : les envois de l'Expéditeur, les trajets publiés
 * et les demandes reçues du Voyageur. « Trajets » ne parlait qu'à une face
 * et laissait croire à des résultats de recherche — d'où le renommage.
 *
 * Derrière la porte d'identité. La coquille montre des chiffres VRAIS (les
 * mêmes que le badge d'onglet) ; le détail est un lot à part.
 *
 * C'est aussi la PORTE UNIQUE de « Publier » depuis qu'il a quitté la barre
 * (A210 e) : le domicile du Voyageur, le seul endroit où il revient. La
 * carte dit honnêtement que le parcours arrive — elle ne renvoie NULLE PART,
 * l'app est full native (A210 b).
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { Ionicons } from '@expo/vector-icons';

import { IdentityGate } from '@/components/identity-gate';
import { ProfileAvatarButton } from '@/components/profile-avatar-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTabBadges } from '@/hooks/use-tab-badges';
import { useSession } from '@/lib/session-context';

function ActivityContent() {
  const t = useTranslations('tabs');
  const { user } = useSession();
  const badges = useTabBadges();
  const isCarrier = user?.roles.includes('CARRIER') ?? false;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.titleRow}>
          {/* `title` et non `subtitle` : le même cran que la porte
              d'identité, pour que le nom de la page ne saute pas d'une taille
              à l'autre au moment où la session s'ouvre. */}
          <ThemedText type="title" style={styles.title}>
            {t('activity.title')}
          </ThemedText>
          <ProfileAvatarButton />
        </View>

        {/* D112 — LA FACE EXPÉDITEUR, qui n'existait pas. `isCarrier &&`
            masquait les seuls compteurs de l'écran : un compte sans rôle
            Voyageur ne voyait qu'une phrase d'attente et une invitation à
            devenir Voyageur, sur l'onglet censé servir « les deux faces ».
            Cette porte est ouverte à TOUT LE MONDE — tout compte peut
            envoyer, et c'est par ici qu'on retrouve le suivi d'un colis. */}
        <View style={styles.counters}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/shipments/mine')}
            style={({ pressed }) => [styles.lien, pressed && styles.pressed]}>
            <ThemedText type="smallBold">{t('activity.myShipments')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.lienCompte}>
              {t('activity.shipmentsToHandle', { count: badges.shipmentsToHandle })}
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={Brand.mango} />
          </Pressable>
        </View>

        {isCarrier && (
          <View style={styles.counters}>
            <ThemedText>{t('activity.pendingDeals', { count: badges.pendingDeals })}</ThemedText>

            {/* D111 quinquies — le compteur de brouillons MÈNE quelque part.
                Il affichait un nombre depuis le lot « onglets » sans que rien
                ne permette d'y aller : un chiffre sur lequel on ne peut pas
                taper est une information qui se périme toute seule. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/trips/mine')}
              style={({ pressed }) => [styles.lien, pressed && styles.pressed]}>
              <ThemedText type="smallBold">{t('activity.myTrips')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.lienCompte}>
                {t('activity.draftTrips', { count: badges.draftTrips })}
              </ThemedText>
              <Ionicons name="chevron-forward" size={16} color={Brand.mango} />
            </Pressable>
          </View>
        )}

        <ThemedText themeColor="textSecondary">{t('activity.note')}</ThemedText>

        {/* La porte de « Publier ». Le bouton est né AVEC le formulaire, et
            actif du premier jour — c'est ce que cette carte promettait depuis
            le lot « onglets » : « le bouton naîtra avec le formulaire ». La
            ligne « arrive dans un prochain lot » a disparu le même jour : une
            coquille honnête cesse de l'être le jour où elle ment. */}
        <ThemedView type="backgroundElement" style={styles.publishCard}>
          <View style={[styles.publishIcon, { backgroundColor: 'rgba(255,153,0,0.16)' }]}>
            <Ionicons name="airplane-outline" size={22} color={Brand.mango} />
          </View>
          <ThemedText type="smallBold">{t('activity.publishTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('activity.publishBody')}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/publish-trip')}
            style={({ pressed }) => [styles.publishCta, { opacity: pressed ? 0.85 : 1 }]}>
            <ThemedText type="smallBold" style={styles.publishCtaLabel}>
              {t('activity.publishCta')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

export default function ActivityScreen() {
  return (
    <IdentityGate destination="activity">
      <ActivityContent />
    </IdentityGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    // La barre d'onglets FLOTTE au-dessus du contenu (D88) : cet écran ne
    // défile pas, c'est donc ici qu'il lui réserve sa place — sans quoi son
    // bas se centrerait SOUS la pilule.
    paddingBottom: BottomTabInset,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flexShrink: 1,
    paddingTop: Spacing.two,
  },
  counters: {
    gap: Spacing.two,
  },
  lien: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  lienCompte: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  publishCta: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  publishCtaLabel: {
    color: '#1A1A1A',
    fontSize: 15,
  },
  publishCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  publishIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
