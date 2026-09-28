/**
 * welcome.tsx — l'atterrissage d'ouverture (itération Revolut, A208).
 * ===================================================================
 * SUPPLANTE l'écran de bienvenue illustré (A207) sur son créneau exact :
 * lancement à FROID en anonyme seulement — jamais un membre connecté,
 * jamais deux fois par session (`welcome-state`, non persisté). La
 * composition de la référence (captures/auth/3) : fond sombre, wordmark,
 * l'illustration du produit, et DEUX gestes en bas — « Créer un compte »
 * (primaire clair) / « Me connecter » ; le X à DROITE atterrit sur
 * Rechercher en anonyme (l'app reste publique, A203). Couleurs FIXES hors
 * thème, comme la référence.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';
import { useTranslations } from 'use-intl';

import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session-context';
import { dismissWelcome, requestBrowseOnLanding } from '@/lib/welcome-state';

const BG = '#0B1120';

export default function WelcomeScreen() {
  const t = useTranslations('welcome');
  const { status } = useSession();

  // Connexion réussie depuis la feuille d'auth : l'écran a rempli son office.
  useEffect(() => {
    if (status === 'authenticated') {
      dismissWelcome();
      router.replace('/(tabs)');
    }
  }, [status]);

  const skip = () => {
    dismissWelcome();
    // Résultats DIRECTS derrière le X (motif Airbnb) : Rechercher lance la
    // recherche large à l'arrivée — de vrais trajets, pas un formulaire vide.
    requestBrowseOnLanding();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topRow}>
          <Pressable
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.wordmark}>Yamba</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>

        <View style={styles.visual}>
          <Image
            source={require('../../assets/images/home-hero-yamba.svg')}
            style={styles.illustration}
            contentFit="contain"
          />
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/register')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryLabel}>{t('createAccount')}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryLabel}>{t('login')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: Spacing.two,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 600,
  },
  wordmark: {
    color: Brand.mango,
    fontSize: 40,
    fontWeight: 800,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 500,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  visual: {
    flex: 1,
    marginVertical: Spacing.four,
  },
  illustration: {
    flex: 1,
  },
  actions: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  primary: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#0B1120',
    fontSize: 16,
    fontWeight: 700,
  },
  secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.75,
  },
});
