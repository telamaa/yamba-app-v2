/**
 * booking/payment/card.tsx — LA PAGE CARTE (D83).
 * ================================================
 * Le moyen « Carte bancaire » a sa page, comme chaque moyen depuis D83. C'est
 * NOTRE écran : titre, champs et bouton sont ceux de Yamba, en français, et
 * non plus la feuille basse de Stripe qui suivait la langue de l'appareil.
 *
 * CE QUI NE PASSE PAS PAR NOTRE CODE. Le numéro, la date et le cryptogramme
 * restent dans le champ NATIF de Stripe (`CardField`) : notre JavaScript ne
 * les voit jamais, et c'est ce qui garde Yamba hors du périmètre PCI. Nous ne
 * transmettons que le secret de l'intention et, s'il est saisi, le nom du
 * porteur.
 *
 * LE 3-D SECURE est géré par le SDK : il ouvre la page de la banque et rend
 * la main ici. L'écran n'a rien à en savoir — et c'est pour cela que le
 * schéma de retour (`yamba://`) est déclaré à l'initialisation (D82 7A).
 *
 * CE QUE CET ÉCRAN NE FAIT PAS. Il n'envoie pas la demande : il pose
 * l'empreinte, la note dans la mémoire du parcours, et se referme. C'est
 * l'écran de paiement qui reprend la main au retour de focus et crée la
 * réservation — l'ordre des gestes d'A45 et de D31 reste intact (photos,
 * puis argent, puis demande).
 *
 * IMPORT STATIQUE ASSUMÉ. `CardField` est un composant natif : ce fichier
 * importe donc `@stripe/stripe-react-native` directement, là où le reste de
 * l'app passe par la porte paresseuse de `lib/stripe-sheet.ts`. La propriété
 * est préservée autrement : cette page n'est ATTEIGNABLE que si la carte
 * figure dans les moyens proposés, et elle n'y figure que si le module natif
 * a pu être chargé.
 */
import { CardField } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { getPendingIntent, markPaymentAuthorized } from '@/lib/payment-choice';
import { authFailureKey } from '@/lib/payment-methods';
import { confirmCardPayment } from '@/lib/stripe-sheet';
import { formatPrice } from '@/lib/trip-format';

export default function PaymentCardScreen() {
  const t = useTranslations('booking');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const intent = getPendingIntent();
  const [complete, setComplete] = useState(false);
  const [holder, setHolder] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountLabel = intent
    ? formatPrice(intent.amountCents, intent.currencyCode, locale)
    : null;

  const payer = useCallback(async () => {
    if (!intent || submitting || !complete) return;
    setSubmitting(true);
    setError(null);
    const outcome = await confirmCardPayment({
      clientSecret: intent.clientSecret,
      holderName: holder,
    });
    if (outcome.ok) {
      // On NOTE et on se referme. L'écran de paiement voit le drapeau au
      // retour de focus et enchaîne : une page poussée ne retourne rien.
      markPaymentAuthorized();
      router.back();
      return;
    }
    // Une annulation n'est pas un refus de carte : le message le dit, et le
    // formulaire reste ouvert sur son bouton (le geste est réessayable).
    setError(t(`card.errors.${authFailureKey(outcome.reason)}`));
    setSubmitting(false);
  }, [complete, holder, intent, submitting, t]);

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

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <ThemedText type="title">{t('card.title')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('card.subtitle')}
            </ThemedText>

            {intent === null ? (
              // Sans empreinte, il n'y a rien à confirmer. Cela arrive si la
              // page est rouverte après que l'intention a été recréée : on le
              // dit et on renvoie en arrière, plutôt que d'afficher un
              // formulaire qui ne pourrait rien valider.
              <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
                <ThemedText type="small">{t('card.expired')}</ThemedText>
              </View>
            ) : (
              <>
                <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
                  {/* Le champ NATIF de Stripe. Les données saisies ici ne
                      traversent jamais notre JavaScript. */}
                  <CardField
                    postalCodeEnabled={false}
                    placeholders={{ number: t('card.placeholder') }}
                    cardStyle={{
                      backgroundColor: theme.background,
                      textColor: theme.text,
                      placeholderColor: theme.textSecondary,
                      borderWidth: 0,
                      borderRadius: 8,
                    }}
                    style={styles.cardField}
                    onCardChange={(details) => setComplete(details.complete)}
                  />
                </View>

                <View style={styles.field}>
                  <ThemedText type="smallBold">{t('card.holder')}</ThemedText>
                  <TextInput
                    value={holder}
                    onChangeText={setHolder}
                    placeholder={t('card.holderPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="words"
                    autoComplete="cc-name"
                    style={[
                      styles.input,
                      { borderColor: theme.backgroundElement, color: theme.text },
                    ]}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('card.holderHint')}
                  </ThemedText>
                </View>

                {/* Ce que l'empreinte engage, redit ICI : c'est le dernier
                    écran avant que l'argent soit bloqué. */}
                <View style={[styles.notice, { borderColor: theme.backgroundElement }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={Brand.teal} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                    {t('card.hold')}
                  </ThemedText>
                </View>

                {error ? (
                  <ThemedText type="small" style={styles.error}>
                    {error}
                  </ThemedText>
                ) : null}
              </>
            )}
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
              disabled={intent === null || !complete || submitting}
              onPress={() => void payer()}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor:
                    intent === null || !complete || submitting
                      ? theme.backgroundSelected
                      : Brand.mango,
                },
                pressed && styles.pressed,
              ]}>
              {submitting ? (
                <ActivityIndicator color={scheme === 'dark' ? '#FFFFFF' : '#000000'} />
              ) : (
                <ThemedText type="smallBold" style={styles.ctaLabel}>
                  {amountLabel ? t('card.cta', { amount: amountLabel }) : t('methods.cta')}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
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
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.two },
  cardField: { width: '100%', height: 50 },
  field: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  error: { color: '#B91C1C' },
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
    minHeight: 48,
  },
  ctaLabel: { color: '#000000' },
  pressed: { opacity: 0.6 },
});
