/**
 * report-sheet.tsx — signaler une annonce (ou, demain, un membre). D68.
 * ======================================================================
 * Une feuille native plutôt qu'une page : signaler est une parenthèse, on
 * revient toujours à ce qu'on regardait. Le geste est court — un motif, deux
 * phrases facultatives, envoyer.
 *
 * Trois états dans la même feuille : la PORTE d'identité pour un visiteur
 * (motif A58/A63 — un signalement est toujours signé), le FORMULAIRE, puis
 * l'ACCUSÉ de réception. Les trois évitent une navigation : on n'envoie
 * personne ailleurs pour une action de dix secondes.
 *
 * Les motifs viennent de la liste FERMÉE du contrat (SIG-01) ; le serveur
 * refuse tout motif hors liste, et ses refus parlent par `details.code`
 * (`OWN_TARGET`, doublon 409, cible invisible 404) — on les traduit, on ne
 * les invente pas.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import {
  createReport,
  REPORT_REASONS_BY_TARGET,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/api/report.api';
import { useSession } from '@/lib/session-context';

const DETAILS_MAX = 500;

type Props = {
  visible: boolean;
  targetType: ReportTargetType;
  targetRef: string;
  onCloseAction: () => void;
};

export function ReportSheet({ visible, targetType, targetRef, onCloseAction }: Props) {
  const t = useTranslations('tripDetail');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { status } = useSession();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    onCloseAction();
    // Remise à zéro APRÈS la fermeture : rouvrir la feuille repart propre,
    // sans qu'on voie le formulaire se vider pendant l'animation.
    setTimeout(() => {
      setReason(null);
      setDetails('');
      setSent(false);
      setError(null);
    }, 250);
  }, [onCloseAction]);

  const submit = useCallback(async () => {
    if (reason === null || sending) return;
    setSending(true);
    setError(null);
    try {
      await createReport({
        targetType,
        targetRef,
        reason,
        ...(details.trim().length > 0 ? { details: details.trim() } : {}),
      });
      setSent(true);
    } catch (err) {
      // `httpStatus`, pas `status` : le statut de SESSION porte déjà ce nom
      // dans ce composant — deux « status » dans une même fonction se lisent
      // mal et se confondent à la relecture.
      const httpStatus = err instanceof ApiError ? err.status : 0;
      const code = err instanceof ApiError ? err.code : null;
      setError(
        code === 'OWN_TARGET'
          ? t('report.ownTarget')
          : httpStatus === 409
            ? t('report.already')
            : httpStatus === 404
              ? t('report.notFound')
              : t('report.failed')
      );
    } finally {
      setSending(false);
    }
  }, [reason, sending, targetType, targetRef, details, t]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
              <ThemedText type="small" themeColor="textSecondary">
                {sent ? t('report.back') : t('report.cancel')}
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{t(`report.title.${targetType}`)}</ThemedText>
            {/* Équilibre le bouton de gauche pour centrer le titre. */}
            <View style={styles.headerSpacer} />
          </View>

          {sent ? (
            <View style={styles.doneBlock}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={26} color="#0B0B0C" />
              </View>
              <ThemedText type="smallBold" style={styles.centered}>
                {t('report.done')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                {t('report.doneHint')}
              </ThemedText>
            </View>
          ) : status !== 'authenticated' ? (
            <View style={styles.doneBlock}>
              <ThemedText type="smallBold" style={styles.centered}>
                {t('report.gateTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                {t('report.gateSubtitle')}
              </ThemedText>
              <Pressable
                onPress={() => {
                  close();
                  router.push('/login');
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
                <ThemedText type="smallBold" style={styles.ctaLabel}>
                  {t('report.signIn')}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('report.intro')}
                </ThemedText>

                <View style={styles.reasons}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                    {t('report.reason')}
                  </ThemedText>
                  {REPORT_REASONS_BY_TARGET[targetType].map((key) => {
                    const active = reason === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setReason(key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        style={({ pressed }) => [
                          styles.reasonRow,
                          {
                            borderColor: active ? Brand.mango : theme.backgroundElement,
                            backgroundColor: active
                              ? 'rgba(255,153,0,0.08)'
                              : theme.backgroundElement,
                          },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText type="small" style={styles.reasonLabel}>
                          {t(`report.reasons.${key}`)}
                        </ThemedText>
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={active ? Brand.mango : theme.textSecondary}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                    {t('report.details')}
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.details,
                      { backgroundColor: theme.backgroundElement, color: theme.text },
                    ]}
                    placeholder={t('report.detailsPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    value={details}
                    onChangeText={setDetails}
                    maxLength={DETAILS_MAX}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {error !== null && (
                  <ThemedText type="small" style={styles.error}>
                    {error}
                  </ThemedText>
                )}
              </ScrollView>

              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: theme.backgroundElement,
                    paddingBottom: Math.max(insets.bottom, Spacing.three),
                  },
                ]}>
                {/* TOUJOURS actif (doctrine A209) : sans motif, le tap NOMME
                    ce qui manque au lieu de laisser un bouton mort. */}
                <Pressable
                  onPress={() =>
                    reason === null ? setError(t('report.reasonMissing')) : void submit()
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
                  {sending ? (
                    <ActivityIndicator color="#0B0B0C" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.ctaLabel}>
                      {t('report.submit')}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: {
    width: 56,
  },
  scroll: {
    gap: Spacing.four,
    padding: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  sectionLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingBottom: Spacing.two,
  },
  reasons: {
    gap: Spacing.two,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  details: {
    minHeight: 96,
    borderRadius: 14,
    padding: Spacing.three,
    fontSize: 15,
  },
  error: {
    color: '#DC2626',
  },
  doneBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.mango,
  },
  centered: {
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.mango,
    alignSelf: 'stretch',
  },
  ctaPressed: {
    backgroundColor: '#F08700',
  },
  ctaLabel: {
    color: '#0B0B0C',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.6,
  },
});
