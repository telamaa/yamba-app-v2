/**
 * welcome.tsx — l'écran de bienvenue (lot bienvenue, ouverture de l'app).
 * =======================================================================
 * Montré à froid quand la session amorce en ANONYME (jamais à un membre
 * connecté). Composition de la référence, identité Yamba : visuel chaud en
 * haut (l'illustration du hero du site — le colis dans les bagages), rangée
 * des modes qui chevauche la frontière, feuille SOMBRE en bas (la signature
 * « bookend » de l'accueil web) avec l'accroche et les gestes. Philosophie
 * « que du vrai » : le bouton primaire est « Se connecter » — pas
 * d'« Inscription » tant que l'écran d'inscription n'existe pas dans l'app
 * (il deviendra le primaire à ce lot-là) ; « Continuer sans compte » et la
 * croix assument l'app PUBLIQUE (A203) : on peut chercher sans identité.
 * Couleurs FIXES (indépendantes du thème), comme la référence photo.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslations } from 'use-intl';

import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session-context';
import { dismissWelcome } from '@/lib/welcome-state';

const SHEET = '#151718';
const WARM = '#FFF6EA';
const MODE_SIZE = 52;

/** Les trois modes de transport du produit, et le colis qui voyage. */
const MODES = [
  { key: 'plane', ios: 'airplane', emoji: '✈️' },
  { key: 'train', ios: 'tram.fill', emoji: '🚆' },
  { key: 'car', ios: 'car.fill', emoji: '🚗' },
  { key: 'parcel', ios: 'shippingbox.fill', emoji: '📦' },
] as const;

export default function WelcomeScreen() {
  const t = useTranslations('welcome');
  const { status } = useSession();

  // Connexion réussie depuis la modale : l'écran a rempli son office.
  useEffect(() => {
    if (status === 'authenticated') {
      dismissWelcome();
      router.replace('/(tabs)');
    }
  }, [status]);

  const skip = () => {
    dismissWelcome();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.visual}>
        <Image
          source={require('../../assets/images/home-hero-yamba.svg')}
          style={styles.illustration}
          contentFit="contain"
          contentPosition="bottom"
        />
        <SafeAreaView edges={['top', 'left']}>
          <Pressable
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </SafeAreaView>
      </View>

      <View style={styles.modes}>
        {MODES.map((mode) => (
          <View key={mode.key} style={styles.modeCircle}>
            <SymbolView
              name={mode.ios}
              size={22}
              tintColor={Brand.mango}
              fallback={<Text style={styles.modeEmoji}>{mode.emoji}</Text>}
            />
          </View>
        ))}
      </View>

      <View style={styles.sheet}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.sheetInner}>
          <Text style={styles.headline}>{t('headline')}</Text>
          <Text style={styles.subline}>{t('subline')}</Text>
          <Pressable
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryLabel}>{t('login')}</Text>
          </Pressable>
          <Pressable onPress={skip} accessibilityRole="button" hitSlop={Spacing.two}>
            <Text style={styles.skipLabel}>{t('skip')}</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WARM,
  },
  visual: {
    flex: 1,
    paddingHorizontal: Spacing.three,
  },
  illustration: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: Spacing.six,
    bottom: 0,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginTop: Spacing.two,
    backgroundColor: 'rgba(21, 23, 24, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
  },
  // La rangée chevauche la frontière visuel / feuille : hauteur nette nulle
  // (marges négatives symétriques), peinte AU-DESSUS des deux voisins.
  modes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
    height: MODE_SIZE,
    marginTop: -MODE_SIZE / 2,
    marginBottom: -MODE_SIZE / 2,
    zIndex: 2,
  },
  modeCircle: {
    width: MODE_SIZE,
    height: MODE_SIZE,
    borderRadius: MODE_SIZE / 2,
    backgroundColor: SHEET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeEmoji: {
    fontSize: 20,
  },
  sheet: {
    backgroundColor: SHEET,
  },
  sheetInner: {
    paddingTop: MODE_SIZE / 2 + Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
    alignItems: 'center',
  },
  headline: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
    textAlign: 'center',
  },
  subline: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 500,
    textAlign: 'center',
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: Brand.mango,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
  },
  skipLabel: {
    color: Brand.mango,
    fontSize: 15,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.7,
  },
});
