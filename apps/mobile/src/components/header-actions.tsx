/**
 * header-actions.tsx — la cloche et la pastille, ensemble (D119 2A).
 * ====================================================================
 * Depuis A210, la pastille Profil est le SEUL accès au compte : elle vit
 * donc sur les QUATRE destinations. La cloche suit le même raisonnement et
 * la même place — et les deux voyagent désormais dans UN composant.
 *
 * Pourquoi un composant plutôt que deux balises recopiées quatre fois :
 * c'est la leçon de D105. Une incohérence de charte ne se lit pas, elle se
 * COMPTE — et quatre copies d'une rangée d'en-tête divergent toujours par
 * un écart, un ordre ou une taille. Ici il n'y a rien à tenir d'accord.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslations } from 'use-intl';

import { ProfileAvatarButton } from '@/components/profile-avatar-button';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useActivite } from '@/lib/activite-context';
import { intlTagFor } from '@/lib/number-format';
import { useLocale } from 'use-intl';

export function HeaderActions() {
  const t = useTranslations('notifications');
  const theme = useTheme();
  const tag = intlTagFor(useLocale());
  const { notificationsNonLues } = useActivite();

  return (
    <View style={styles.rangee}>
      <Pressable
        onPress={() => router.push('/notifications')}
        accessibilityRole="button"
        accessibilityLabel={t('bell')}
        hitSlop={8}
        style={styles.cloche}>
        <Ionicons name="notifications-outline" size={22} color={theme.text} />
        {notificationsNonLues > 0 ? (
          <View style={[styles.pastille, { backgroundColor: Brand.mango }]}>
            <ThemedText type="small" style={styles.pastilleTexte}>
              {notificationsNonLues.toLocaleString(tag)}
            </ThemedText>
          </View>
        ) : null}
      </Pressable>
      <ProfileAvatarButton />
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cloche: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  pastille: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleTexte: { color: '#1A1A1A', fontFamily: Font.bold, fontSize: 10 },
});
