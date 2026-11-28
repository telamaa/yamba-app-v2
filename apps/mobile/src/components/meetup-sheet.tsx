/**
 * meetup-sheet.tsx — proposer un rendez-vous (D118).
 * ====================================================
 * Une feuille, pas une page : proposer est une parenthèse de vingt secondes
 * dont on revient toujours au fil.
 *
 * ── LE CONTRÔLE EST UNE GRAMMAIRE ───────────────────────────────────────
 * Le site demande DEUX `datetime-local` — début et fin — puis traduit les
 * trois refus du serveur. Ici on compose **un jour, une heure, une durée** :
 *
 *   • la durée vient d'une liste de paliers → `END_BEFORE_START` et
 *     `WINDOW_TOO_LONG` ne peuvent PAS être exprimés ;
 *   • la bande de jours s'arrête bien avant les 90 jours → `TOO_FAR` non plus ;
 *   • les heures passées ou à moins de trente minutes ne sont pas offertes
 *     → `TOO_SOON` disparaît du vocabulaire de l'écran.
 *
 * Ce n'est pas de la validation : c'est la forme du contrôle. Un garde-fou
 * qui ne demande à personne de s'en souvenir.
 *
 * Les règles, elles, vivent dans `lib/rendez-vous.ts` (pur) — cet écran n'a
 * que des effets.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
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

import { useLocale, useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { proposerLeRendezVous } from '@/lib/api/messages.api';
import { intlTagFor } from '@/lib/number-format';
import {
  DETAIL_MAX,
  DUREES_MINUTES,
  LIEU_MAX,
  cleDuRefusDuRendezVous,
  corpsDuRendezVous,
  heuresProposables,
  joursProposables,
  manquesDuRendezVous,
  type CreneauChoisi,
  type DureeMinutes,
  type GenreDeRendezVous,
  type JourProposable,
} from '@/lib/rendez-vous';

export function MeetupSheet({
  visible,
  conversationId,
  peutEcrire,
  onCloseAction,
  onProposeAction,
}: {
  visible: boolean;
  conversationId: string;
  peutEcrire: boolean;
  onCloseAction: () => void;
  /** Appelée après une proposition acceptée par le serveur. */
  onProposeAction: () => void;
}) {
  const t = useTranslations('messaging');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tag = intlTagFor(useLocale());

  const [genre, setGenre] = useState<GenreDeRendezVous>('PICKUP');
  const [jour, setJour] = useState<JourProposable | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [duree, setDuree] = useState<DureeMinutes>(60);
  const [lieu, setLieu] = useState('');
  const [detail, setDetail] = useState('');
  const [envoiEnCours, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [montrerLesManques, setMontrerLesManques] = useState(false);

  // L'instant est figé à l'OUVERTURE de la feuille : recalculer « maintenant »
  // à chaque rendu ferait disparaître une heure sous le doigt au passage
  // d'un quart d'heure.
  const [ouvertA] = useState(() => Date.now());
  const jours = useMemo(() => joursProposables(ouvertA), [ouvertA]);
  const heures = useMemo(
    () => (jour === null ? [] : heuresProposables(jour, ouvertA)),
    [jour, ouvertA]
  );

  const choix: CreneauChoisi = { jour, minutes, duree, lieu, detail, genre };
  const manques = manquesDuRendezVous({ choix, peutEcrire, envoiEnCours });
  const premierManque = manques[0];

  const fermer = useCallback(() => {
    onCloseAction();
    setTimeout(() => {
      setJour(null);
      setMinutes(null);
      setLieu('');
      setDetail('');
      setRefus(null);
      setMontrerLesManques(false);
    }, 250);
  }, [onCloseAction]);

  const envoyer = useCallback(async () => {
    const corps = corpsDuRendezVous({ choix, peutEcrire, envoiEnCours });
    // Pas de bouton désactivé (A209) : il dit ce qui le retient.
    if (corps === null) {
      setMontrerLesManques(true);
      return;
    }
    setEnvoi(true);
    setRefus(null);
    try {
      await proposerLeRendezVous(conversationId, corps);
      onProposeAction();
      fermer();
    } catch (e) {
      const details = e instanceof ApiError ? e.details : null;
      setRefus(
        t(
          `meetup.errors.${cleDuRefusDuRendezVous(
            e instanceof ApiError ? e.code : null,
            details?.reason
          )}`
        )
      );
    } finally {
      setEnvoi(false);
    }
  }, [choix, peutEcrire, envoiEnCours, conversationId, onProposeAction, fermer, t]);

  const libelleDuJour = (j: JourProposable) =>
    new Date(j.minuitMs).toLocaleDateString(tag, { weekday: 'short', day: 'numeric' });

  const libelleDeLHeure = (m: number) =>
    new Date(2026, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(tag, {
      hour: '2-digit',
      minute: '2-digit',
    });

  const phraseDuManque = (): string | null => {
    if (premierManque === undefined) return null;
    if (premierManque.quoi === 'ferme') return t('closed.autre');
    if (premierManque.quoi === 'lieu')
      return t('meetup.missing.lieu', { count: premierManque.caracteres });
    if (premierManque.quoi === 'lieu-trop-long')
      return t('meetup.missing.lieuTropLong', { count: premierManque.dePlus });
    if (premierManque.quoi === 'detail-trop-long')
      return t('meetup.missing.detailTropLong', { count: premierManque.dePlus });
    return t(`meetup.missing.${premierManque.quoi}`);
  };

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
                {t('meetup.cancel')}
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{t('meetup.propose')}</ThemedText>
            <View style={styles.equilibre} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.corps, { paddingBottom: insets.bottom + Spacing.six }]}
            keyboardShouldPersistTaps="handled">
            {/* ── Quel moment du transport ─────────────────────────── */}
            <Champ titre={t('meetup.kind')}>
              <View style={styles.rangee}>
                {(['PICKUP', 'DELIVERY'] as const).map((g) => (
                  <Puce
                    key={g}
                    actif={genre === g}
                    label={t(g === 'PICKUP' ? 'meetup.pickup' : 'meetup.delivery')}
                    onPressAction={() => setGenre(g)}
                  />
                ))}
              </View>
            </Champ>

            {/* ── Le jour : une bande, pas un calendrier de 90 jours ── */}
            <Champ titre={t('meetup.day')}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bande}>
                {jours.map((j) => (
                  <Puce
                    key={j.cle}
                    actif={jour?.cle === j.cle}
                    label={libelleDuJour(j)}
                    onPressAction={() => {
                      setJour(j);
                      // Changer de jour peut rendre l'heure choisie
                      // impossible (le lendemain à 8 h existe, aujourd'hui
                      // à 8 h non) : on la relâche plutôt que de la garder
                      // en silence.
                      setMinutes(null);
                    }}
                  />
                ))}
              </ScrollView>
            </Champ>

            {/* ── L'heure : seulement celles que le serveur accepterait ── */}
            {jour !== null && (
              <Champ titre={t('meetup.hour')}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bande}>
                  {heures.map((m) => (
                    <Puce
                      key={m}
                      actif={minutes === m}
                      label={libelleDeLHeure(m)}
                      onPressAction={() => setMinutes(m)}
                    />
                  ))}
                </ScrollView>
              </Champ>
            )}

            {/* ── La durée : des paliers, donc jamais une fenêtre folle ── */}
            <Champ titre={t('meetup.duration')}>
              <View style={styles.rangee}>
                {DUREES_MINUTES.map((d) => (
                  <Puce
                    key={d}
                    actif={duree === d}
                    label={t(`meetup.durations.${d}`)}
                    onPressAction={() => setDuree(d)}
                  />
                ))}
              </View>
            </Champ>

            <Champ titre={t('meetup.place')}>
              <TextInput
                value={lieu}
                onChangeText={(texte) => setLieu(texte.slice(0, LIEU_MAX))}
                placeholder={t('meetup.placePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.saisie,
                  { backgroundColor: theme.backgroundElement, color: theme.text },
                ]}
              />
            </Champ>

            <Champ titre={t('meetup.detail')}>
              <TextInput
                value={detail}
                onChangeText={(texte) => setDetail(texte.slice(0, DETAIL_MAX))}
                placeholder={t('meetup.detailPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[
                  styles.saisie,
                  styles.saisieLongue,
                  { backgroundColor: theme.backgroundElement, color: theme.text },
                ]}
              />
            </Champ>

            {refus !== null ? (
              <ThemedText type="small" style={styles.refus}>
                {refus}
              </ThemedText>
            ) : null}

            <Pressable
              onPress={() => void envoyer()}
              accessibilityRole="button"
              accessibilityState={{ busy: envoiEnCours }}
              style={[
                styles.envoyer,
                {
                  backgroundColor:
                    premierManque === undefined ? Brand.mango : theme.backgroundElement,
                },
              ]}>
              {envoiEnCours ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <ThemedText
                  type="smallBold"
                  style={premierManque === undefined ? styles.envoyerTexte : undefined}>
                  {t('meetup.send')}
                </ThemedText>
              )}
            </Pressable>

            {/* Le bouton n'est jamais muet : il dit ce qui le retient. */}
            {montrerLesManques && premierManque !== undefined ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centre}>
                {phraseDuManque()}
              </ThemedText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedView>
    </Modal>
  );
}

function Champ({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={styles.champ}>
      <ThemedText type="small" themeColor="textSecondary">
        {titre}
      </ThemedText>
      {children}
    </View>
  );
}

function Puce({
  actif,
  label,
  onPressAction,
}: {
  actif: boolean;
  label: string;
  onPressAction: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPressAction}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
      style={[
        styles.puce,
        {
          borderColor: actif ? Brand.mango : theme.backgroundElement,
          backgroundColor: actif ? theme.backgroundElement : 'transparent',
        },
      ]}>
      <ThemedText type="small" style={actif ? styles.puceActive : undefined}>
        {label}
      </ThemedText>
    </Pressable>
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
    gap: Spacing.four,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  champ: { gap: Spacing.two },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  bande: { gap: Spacing.two, paddingRight: Spacing.four },
  puce: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    borderWidth: 1,
  },
  puceActive: { fontFamily: Font.semibold },
  saisie: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontFamily: Font.regular,
    fontSize: 15,
  },
  saisieLongue: {
    minHeight: 80,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  refus: { color: '#DC2626' },
  envoyer: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  envoyerTexte: { color: '#1A1A1A' },
  centre: { textAlign: 'center' },
});
