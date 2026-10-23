/**
 * booking/payment/method.tsx — LE CHOIX DU MOYEN DE PAIEMENT (D83).
 * ==================================================================
 * L'écran que D83 a gravé : plein écran, à nous, en français — et non plus la
 * feuille basse de Stripe, qui ne sait pas se mettre en page et qui suit la
 * langue de l'APPAREIL, pas celle de l'app.
 *
 * Sa grammaire est celle de la maquette de référence : UNE carte arrondie,
 * des lignes séparées par un filet, un logo à gauche, le radio à DROITE, et
 * un grand bouton en bas qui ouvre la page du moyen retenu.
 *
 * CE QU'IL N'INVENTE PAS. Les lignes viennent de `availableMethods`
 * (`lib/payment-methods.ts`) : l'intersection de ce que l'empreinte accepte —
 * servi par le serveur depuis D83 4A — et de ce que l'app sait conduire. Deux
 * conséquences visibles ici :
 *
 *   • la ligne du portefeuille (Apple Pay / Google Pay) n'apparaît que si
 *     l'appareil a répondu OUI à `isPlatformPaySupported()`. Jamais sur un
 *     `Platform.OS === 'ios'` : un simulateur sans portefeuille, un téléphone
 *     sans carte enregistrée disent non, et un bouton mort ne doit pas
 *     exister (A209) ;
 *   • « Carte bancaire » est UNE ligne, pas deux. CB est un RÉSEAU de carte
 *     chez Stripe, pas un moyen de paiement : les réseaux se CITENT sous le
 *     libellé (réassurance), ils ne se choisissent pas (D83 2A).
 *
 * Le choix vit dans `lib/payment-choice.ts` (mémoire de processus) : cette
 * page est POUSSÉE, et une page poussée ne retourne rien à celle qui l'a
 * poussée.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getIntentMethods, resolvedChoice, setPaymentChoice } from '@/lib/payment-choice';
import {
  CARD_NETWORKS,
  availableMethods,
  flowOf,
  isWallet,
  keepOrDefault,
  type PaymentMethodKey,
} from '@/lib/payment-methods';
import { isWalletSupported } from '@/lib/stripe-sheet';

/** L'icône de chaque ligne. Ionicons porte PayPal, Apple et Google ; la carte
 *  garde une icône générique — aucun logo de réseau n'est embarqué comme
 *  image, les réseaux sont CITÉS en toutes lettres sous le libellé. */
const ICONS: Record<PaymentMethodKey, keyof typeof Ionicons.glyphMap> = {
  card: 'card-outline',
  paypal: 'logo-paypal',
  applePay: 'logo-apple',
  googlePay: 'logo-google',
};

export default function PaymentMethodScreen() {
  const t = useTranslations('booking');
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Le verdict de l'appareil est MESURÉ une fois, à l'ouverture (l'appel est
  // NATIF, donc asynchrone). Tant qu'il n'a pas répondu, on ne propose pas le
  // portefeuille : proposer puis retirer est pire que proposer un peu tard.
  const [walletSupported, setWalletSupported] = useState(false);
  useEffect(() => {
    let vivant = true;
    void isWalletSupported().then((ok) => {
      if (vivant) setWalletSupported(ok);
    });
    return () => {
      vivant = false;
    };
  }, []);
  const serverTypes = getIntentMethods();

  const methods = useMemo(
    () => availableMethods({ serverTypes, walletSupported, platform: Platform.OS }),
    [serverTypes, walletSupported]
  );

  // Lecture PURE : `resolvedChoice` répond sans rien écrire. Écrire ici
  // préviendrait les abonnés PENDANT le rendu, donc mettrait à jour l'écran de
  // paiement en plein rendu de celui-ci — React le refuse, et c'est un défaut
  // payé le 23/10. La mémoire se met à jour dans l'effet ci-dessous.
  const [selected, setSelected] = useState<PaymentMethodKey | null>(() =>
    resolvedChoice(methods)
  );

  // La liste GRANDIT quand le portefeuille répond : le choix est re-normalisé,
  // sans jamais écraser celui que l'Expéditeur vient de faire à la main. Et
  // c'est ICI, dans un effet, que la mémoire est alignée sur l'affichage.
  useEffect(() => {
    const retenu = keepOrDefault(selected, methods);
    if (retenu !== selected) setSelected(retenu);
    setPaymentChoice(retenu);
  }, [methods, selected]);

  const choisir = useCallback((key: PaymentMethodKey) => {
    setSelected(key);
    setPaymentChoice(key);
  }, []);

  const valider = useCallback(() => {
    if (selected === null) return;
    setPaymentChoice(selected);
    router.back();
  }, [selected]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* La barre : un seul geste de sortie. Un « retour » ET une croix qui
            font la même chose demanderaient de choisir entre deux boutons
            identiques. */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('methods.back')}
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Spacing.six }]}
          keyboardShouldPersistTaps="handled">
          <ThemedText type="title" style={styles.title}>
            {t('methods.title')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('methods.subtitle')}
          </ThemedText>

          {methods.length === 0 ? (
            // Aucun moyen : c'est le fournisseur Fake du poste de
            // développement, ou une empreinte qui n'a rien annoncé. On le DIT
            // plutôt que d'afficher une carte vide.
            <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
              <View style={styles.emptyRow}>
                <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {t('methods.none')}
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
              {methods.map((key, index) => (
                <View key={key}>
                  {index > 0 ? (
                    <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />
                  ) : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected === key }}
                    accessibilityLabel={t(`methods.${key}.label`)}
                    accessibilityHint={t(`methods.${key}.hint`)}
                    onPress={() => choisir(key)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <Ionicons
                      name={ICONS[key]}
                      size={24}
                      color={isWallet(key) ? theme.text : Brand.teal}
                      style={styles.rowIcon}
                    />
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{t(`methods.${key}.label`)}</ThemedText>
                      {key === 'card' ? (
                        // Les réseaux acceptés, cités — jamais choisis (D83 2A).
                        <View style={styles.networks}>
                          {CARD_NETWORKS.map((reseau) => (
                            <View
                              key={reseau}
                              style={[styles.network, { borderColor: theme.backgroundElement }]}>
                              <ThemedText type="small" themeColor="textSecondary">
                                {reseau}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <ThemedText type="small" themeColor="textSecondary">
                          {t(`methods.${key}.hint`)}
                        </ThemedText>
                      )}
                    </View>
                    {/* Le radio, à DROITE comme sur la maquette. */}
                    <View
                      style={[
                        styles.radio,
                        { borderColor: selected === key ? theme.text : theme.backgroundSelected },
                      ]}>
                      {selected === key ? (
                        <View style={[styles.radioDot, { backgroundColor: theme.text }]} />
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Ce qui va se passer, dit AVANT : une page de saisie, une sortie
              de l'app, ou la feuille du système. La surprise au moment de
              payer est ce qui fait abandonner. */}
          {selected !== null ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.flowHint}>
              {t(`methods.flows.${flowOf(selected)}`)}
            </ThemedText>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            {
              borderTopColor: theme.backgroundElement,
              paddingBottom: Math.max(insets.bottom, Spacing.three),
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            disabled={selected === null}
            onPress={valider}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: selected === null ? theme.backgroundSelected : Brand.mango },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={styles.ctaLabel}>
              {t('methods.cta')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  title: { marginTop: Spacing.two },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowIcon: { width: 28, textAlign: 'center' },
  flex: { flex: 1, gap: Spacing.one },
  networks: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  network: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  flowHint: { paddingHorizontal: Spacing.one },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  cta: {
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: '#000000' },
  pressed: { opacity: 0.6 },
});
