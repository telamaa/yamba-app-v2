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
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { Ionicons } from '@expo/vector-icons';

import { IdentityGate } from '@/components/identity-gate';
import { ProfileAvatarButton } from '@/components/profile-avatar-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
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
          <ThemedText type="subtitle" style={styles.title}>
            {t('activity.title')}
          </ThemedText>
          <ProfileAvatarButton />
        </View>

        {isCarrier && (
          <View style={styles.counters}>
            <ThemedText>{t('activity.pendingDeals', { count: badges.pendingDeals })}</ThemedText>
            <ThemedText>{t('activity.draftTrips', { count: badges.draftTrips })}</ThemedText>
          </View>
        )}

        <ThemedText themeColor="textSecondary">{t('activity.note')}</ThemedText>

        {/* La porte de « Publier ». PAS de bouton tant que le parcours natif
            n'existe pas : un CTA désactivé en permanence que rien n'explique
            viole la doctrine A209 du bouton désactivé, et promettrait un
            écran absent (A203). La carte INVITE et dit la vérité ; le bouton
            naîtra avec le formulaire, actif du premier jour. */}
        <ThemedView type="backgroundElement" style={styles.publishCard}>
          <View style={[styles.publishIcon, { backgroundColor: 'rgba(255,153,0,0.16)' }]}>
            <Ionicons name="airplane-outline" size={22} color={Brand.mango} />
          </View>
          <ThemedText type="smallBold">{t('activity.publishTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('activity.publishBody')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('activity.publishSoon')}
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

export default function ActivityScreen() {
  return (
    <IdentityGate>
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
    gap: Spacing.one,
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
