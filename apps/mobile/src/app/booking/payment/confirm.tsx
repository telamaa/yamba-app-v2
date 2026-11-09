/**
 * booking/payment/confirm.tsx — LA PAGE DES MOYENS QUI S'OUVRENT AILLEURS (D83).
 * ==============================================================================
 * PayPal part dans un navigateur ; Apple Pay et Google Pay ouvrent la feuille
 * du système. Dans les deux cas, l'écran de Yamba ne contient aucun champ —
 * mais il existe quand même, et c'est volontaire :
 *
 *   • il DIT ce qui est en train de s'ouvrir, pendant la seconde où l'app
 *     semble ne rien faire ;
 *   • il est l'endroit où l'on revient si l'on annule, avec un bouton pour
 *     réessayer — sans lui, une annulation renverrait à l'écran de paiement
 *     sans rien expliquer ;
 *   • il donne au parcours la même forme pour les trois moyens : un choix,
 *     puis une page.
 *
 * Il DÉCLENCHE au montage : le membre vient d'appuyer sur « Suivant », lui
 * demander de confirmer une seconde fois serait un clic pour rien.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPaymentChoice, getPendingIntent, markPaymentAuthorized } from '@/lib/payment-choice';
import { authFailureKey, isWallet, type PaymentMethodKey } from '@/lib/payment-methods';
import { confirmWithRedirect, confirmWithWallet } from '@/lib/stripe-sheet';

export default function PaymentConfirmScreen() {
  const t = useTranslations('booking');
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const intent = getPendingIntent();
  const methode = getPaymentChoice();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Le déclenchement automatique n'a lieu QU'UNE fois : un réessai est un
   *  geste, pas un effet de bord d'un nouveau rendu. */
  const lance = useRef(false);

  const confirmer = useCallback(
    async (key: PaymentMethodKey) => {
      if (!intent) return;
      setBusy(true);
      setError(null);
      const outcome = isWallet(key)
        ? await confirmWithWallet({
            clientSecret: intent.clientSecret,
            // Le MONTANT du devis serveur : la feuille du système affiche ce
            // qu'on lui dit, pas ce que l'intention contient.
            amountCents: intent.amountCents,
            currencyCode: intent.currencyCode,
            merchantName: 'Yamba',
          })
        : await confirmWithRedirect({
            clientSecret: intent.clientSecret,
            paymentMethodType: 'PayPal',
          });

      if (outcome.ok) {
        // On NOTE et on se referme : l'écran de paiement reprend au focus.
        markPaymentAuthorized();
        router.back();
        return;
      }
      setError(t(`confirm.errors.${authFailureKey(outcome.reason)}`));
      setBusy(false);
    },
    [intent, t]
  );

  useEffect(() => {
    if (lance.current || methode === null || intent === null) {
      if (methode === null || intent === null) setBusy(false);
      return;
    }
    lance.current = true;
    void confirmer(methode);
  }, [confirmer, intent, methode]);

  /**
   * Le titre NOMME la page : le moyen qu'on est en train d'ouvrir.
   *
   * Le repli ne peut pas être `methods.title` (« Comment veux-tu payer ? ») :
   * c'est le titre de l'écran de CHOIX, et le reprendre ici ferait poser à la
   * page une question à laquelle elle ne répond pas — pire, elle la poserait
   * juste au-dessus d'un texte qui annonce que l'autorisation a expiré. Vu en
   * recette au simulateur le 08/11. Le repli décrit donc l'ÉTAT de la page,
   * comme `card.tsx` qui garde son propre titre en toute circonstance.
   */
  const titre = methode ? t(`methods.${methode}.label`) : t('confirm.expiredTitle');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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

        <View style={styles.content}>
          <ThemedText type="title">{titre}</ThemedText>

          {intent === null || methode === null ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('card.expired')}
            </ThemedText>
          ) : busy ? (
            <View style={styles.row}>
              <ActivityIndicator color={Brand.mango} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {t(`confirm.opening.${isWallet(methode) ? 'wallet' : 'redirect'}`)}
              </ThemedText>
            </View>
          ) : (
            <>
              {error ? (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {t('confirm.retryHint')}
              </ThemedText>
            </>
          )}
        </View>

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
            disabled={busy || intent === null || methode === null}
            onPress={() => methode && void confirmer(methode)}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor:
                  busy || intent === null || methode === null
                    ? theme.backgroundSelected
                    : Brand.mango,
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={styles.ctaLabel}>
              {t('confirm.retry')}
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
  flex: { flex: 1 },
  topBar: {
    paddingHorizontal: Spacing.four,
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
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  error: { color: '#B91C1C' },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  cta: {
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  ctaLabel: { color: '#000000' },
  pressed: { opacity: 0.6 },
});
