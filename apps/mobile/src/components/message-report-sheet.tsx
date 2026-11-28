/**
 * message-report-sheet.tsx — signaler UN MESSAGE (D117 6A, D61 7A).
 * ===================================================================
 * Une feuille, pas une page : signaler est une parenthèse, on revient
 * toujours au fil. Deux états dans la même feuille — le formulaire, puis
 * l'accusé de réception — parce qu'on n'envoie personne ailleurs pour une
 * action de dix secondes.
 *
 * ── POURQUOI UNE SECONDE FEUILLE, ET NON `report-sheet.tsx` ────────────
 * `ReportSheet` (D68) signale une ANNONCE ou un MEMBRE : autre service
 * (auth-service `/reports`), autre liste de motifs, autres refus
 * (`OWN_TARGET`, doublon 409, cible invisible 404). Les généraliser
 * demanderait de faire passer l'espace de noms, la liste, l'appel et la
 * table des refus en paramètres — c'est-à-dire de toucher un composant que
 * le tunnel de réservation et la page d'un trajet montent déjà.
 *
 * On applique la règle de D115 3A, qui vaut dans les deux sens : **on
 * factorise au moment où l'on devient le TROISIÈME, pas le second.** Une
 * fiche COMPTE les feuilles de signalement à deux ; celui qui en ajoutera
 * une troisième la verra rougir, et ce sera le bon moment.
 *
 * Les motifs viennent de la liste FERMÉE du contrat (`MESSAGE_REPORT_REASONS`),
 * recopiée faute de pouvoir importer le contrat (A223) et confrontée au Zod
 * réel par une fiche.
 */
import { Ionicons } from '@expo/vector-icons';
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
import { Font } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { signalerLeMessage } from '@/lib/api/messages.api';
import { MOTIFS_DE_SIGNALEMENT, type MotifDeSignalement } from '@/lib/fil';

const DETAILS_MAX = 500;

export function MessageReportSheet({
  visible,
  conversationId,
  messageId,
  onCloseAction,
}: {
  visible: boolean;
  conversationId: string;
  messageId: string;
  onCloseAction: () => void;
}) {
  const t = useTranslations('messaging');
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [motif, setMotif] = useState<MotifDeSignalement | null>(null);
  const [details, setDetails] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const fermer = useCallback(() => {
    onCloseAction();
    // Remise à zéro APRÈS la fermeture : rouvrir repart propre, sans qu'on
    // voie le formulaire se vider pendant l'animation.
    setTimeout(() => {
      setMotif(null);
      setDetails('');
      setEnvoye(false);
      setErreur(null);
    }, 250);
  }, [onCloseAction]);

  const envoyer = useCallback(async () => {
    if (motif === null || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await signalerLeMessage(conversationId, messageId, {
        reason: motif,
        ...(details.trim().length > 0 ? { details: details.trim() } : {}),
      });
      setEnvoye(true);
    } catch {
      setErreur(t('report.failed'));
    } finally {
      setEnvoi(false);
    }
  }, [motif, envoi, conversationId, messageId, details, t]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={fermer}>
      <ThemedView style={styles.plein}>
        <KeyboardAvoidingView
          style={styles.plein}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.entete, { borderBottomColor: theme.backgroundElement }]}>
            <Pressable onPress={fermer} hitSlop={12} accessibilityRole="button">
              <ThemedText type="small" themeColor="textSecondary">
                {/* Après l'envoi, « Annuler » serait un contresens : il n'y
                    a plus rien à annuler, il n'y a qu'à refermer. */}
                {envoye ? t('report.close') : t('report.cancel')}
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{t('report.title')}</ThemedText>
            <View style={styles.equilibre} />
          </View>

          {envoye ? (
            <View style={styles.accuse}>
              <Ionicons name="checkmark-circle" size={44} color={Brand.teal} />
              <ThemedText type="smallBold" style={styles.centre}>
                {t('report.done')}
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.corps, { paddingBottom: insets.bottom + Spacing.six }]}
              keyboardShouldPersistTaps="handled">
              <ThemedText type="small" themeColor="textSecondary">
                {t('report.why')}
              </ThemedText>

              <View style={styles.motifs}>
                {MOTIFS_DE_SIGNALEMENT.map((cle) => {
                  const choisi = motif === cle;
                  return (
                    <Pressable
                      key={cle}
                      onPress={() => setMotif(choisi ? null : cle)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: choisi }}
                      style={[
                        styles.motif,
                        {
                          borderColor: choisi ? Brand.mango : theme.backgroundElement,
                          backgroundColor: choisi ? theme.backgroundElement : 'transparent',
                        },
                      ]}>
                      <ThemedText type="small" style={styles.motifTexte}>
                        {t(`report.reasons.${cle}`)}
                      </ThemedText>
                      {choisi ? (
                        <Ionicons name="checkmark-circle" size={18} color={Brand.mango} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={details}
                onChangeText={(texte) => setDetails(texte.slice(0, DETAILS_MAX))}
                placeholder={t('report.details')}
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[
                  styles.details,
                  { backgroundColor: theme.backgroundElement, color: theme.text },
                ]}
              />

              {erreur !== null ? (
                <ThemedText type="small" style={styles.erreur}>
                  {erreur}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={() => void envoyer()}
                accessibilityRole="button"
                accessibilityState={{ busy: envoi, disabled: motif === null }}
                style={[
                  styles.envoyer,
                  { backgroundColor: motif === null ? theme.backgroundElement : Brand.mango },
                ]}>
                {envoi ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <ThemedText
                    type="smallBold"
                    style={motif === null ? undefined : styles.envoyerTexte}>
                    {t('report.submit')}
                  </ThemedText>
                )}
              </Pressable>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  equilibre: { width: 56 },
  corps: {
    gap: Spacing.three,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  motifs: { gap: Spacing.two },
  motif: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  motifTexte: { flex: 1 },
  details: {
    minHeight: 88,
    borderRadius: 12,
    padding: Spacing.three,
    fontFamily: Font.regular,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  erreur: { color: '#DC2626' },
  envoyer: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  envoyerTexte: { color: '#1A1A1A' },
  accuse: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centre: { textAlign: 'center' },
});
