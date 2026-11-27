/**
 * deal/[id]/pickup.tsx — LA PRISE EN CHARGE (D115).
 * ===================================================
 * Le geste qui justifie une app. Il se fait DEBOUT, dans un hall de gare ou
 * devant un comptoir d'enregistrement, colis ouvert entre les mains et
 * l'Expéditeur en face — jamais devant un ordinateur. D'où trois choix
 * qu'aucune maquette web ne suggère :
 *   • l'appareil photo AVANT la photothèque, et les deux boutons visibles
 *     (le site ouvre un sélecteur de fichiers, les trois autres écrans
 *     natifs posent une alerte à trois branches) ;
 *   • la checklist écrite en PHRASES plutôt qu'en étiquettes : on déclare
 *     avoir vu, on ne remplit pas un formulaire ;
 *   • le refus gardé SOUS LES YEUX — le cacher pousserait à accepter un
 *     colis douteux, ce que l'inspection cherche précisément à éviter.
 *
 * LE VOYAGEUR NE VOIT JAMAIS LE CODE. Le serveur le génère ICI et le révèle
 * à l'Expéditeur SEUL (D43, INV-1) : cet écran ne l'affiche pas, ne le
 * demande pas, et une fiche l'interdit. C'est au lot suivant que le
 * Voyageur le SAISIRA, dicté par le destinataire.
 *
 * TOUT CE QUI SE DÉCIDE EST DANS `lib/prise-en-charge.ts` (pur) : ce qui
 * manque pour envoyer est une LISTE, pas un booléen, afin que la barre du
 * bas puisse dire POURQUOI elle n'envoie pas encore (doctrine A209 — un
 * bouton éteint que rien n'explique est un cul-de-sac).
 *
 * LE SERVEUR DÉCIDE DU DROIT : `pickup` ∈ `allowedActions`. Sans lui,
 * l'écran ne montre pas un formulaire qu'on ne pourrait pas envoyer — il dit
 * pourquoi et ramène à la demande (même parti pris que `report.tsx`).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { BackButton } from '@/components/back-button';
import { IdentityGate } from '@/components/identity-gate';
import { PhotoShelf } from '@/components/photo-shelf';
import { Action, Choice, Notice, Section } from '@/components/shipment/shipment-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePhotos } from '@/hooks/use-photos';
import { useTheme } from '@/hooks/use-theme';
import { useTopInset } from '@/hooks/use-top-inset';
import { ApiError } from '@/lib/api/client';
import {
  MauvaisRoleError,
  laDemande,
  prendreEnCharge,
  refuserLaPriseEnCharge,
} from '@/lib/api/my-deals.api';
import { PHOTO_MAX_MB, uploadPickupPhoto } from '@/lib/api/upload.api';
import { demandeDeLApi, peut, type DemandeDeLaListe } from '@/lib/mes-demandes';
import {
  NOTES_MAX,
  PHOTOS_MAX,
  POINTS_INSPECTION,
  RAISONS_REFUS,
  basculerPoint,
  corpsDeLaPriseEnCharge,
  manquesDeLaPriseEnCharge,
  type PointInspection,
  type RaisonRefus,
} from '@/lib/prise-en-charge';

type Etat =
  | { phase: 'chargement' }
  | { phase: 'erreur'; mauvaisRole: boolean }
  | { phase: 'interdite'; demande: DemandeDeLaListe }
  | { phase: 'prete'; demande: DemandeDeLaListe };

function PriseEnChargeContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('pickup');
  const theme = useTheme();
  const topInset = useTopInset();
  const insets = useSafeAreaInsets();

  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });
  const [points, setPoints] = useState<readonly PointInspection[]>([]);
  const [notes, setNotes] = useState('');
  const [montrerLesManques, setMontrerLesManques] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  /* Les deux issues de l'écran. Déclarées AVEC les autres états : un hook
     posé après une sortie anticipée est refusé par `hooks-avant-sortie`. */
  const [confirme, setConfirme] = useState(false);
  const [refuse, setRefuse] = useState(false);

  /* ── Le refus ─────────────────────────────────────────────────────────── */
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [raison, setRaison] = useState<RaisonRefus | null>(null);
  const [refusEnCours, setRefusEnCours] = useState(false);

  /* ── Les photos ───────────────────────────────────────────────────────── */
  // Le refus de permission a ses mots ICI : le hook ne connaît aucun
  // dictionnaire, et ces deux phrases parlent du COLIS, pas d'un fichier.
  const [permissionRefusee, setPermissionRefusee] = useState<'camera' | 'photothèque' | null>(
    null
  );
  const { photos, choisir, retirer, reessayer } = usePhotos({
    max: PHOTOS_MAX,
    televerser: uploadPickupPhoto,
    onRefus: (source) => setPermissionRefusee(source),
  });

  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void laDemande(id ?? '')
        .then((brut) => {
          if (!vivant) return;
          const demande = demandeDeLApi(brut);
          if (demande === null) {
            setEtat({ phase: 'erreur', mauvaisRole: false });
            return;
          }
          // Le DROIT vient du serveur, jamais d'une déduction de statut : la
          // machine à états connaît la fenêtre, l'app ne la recalcule pas.
          setEtat(
            peut(demande, 'pickup')
              ? { phase: 'prete', demande }
              : { phase: 'interdite', demande }
          );
        })
        .catch((erreur) => {
          if (vivant)
            setEtat({ phase: 'erreur', mauvaisRole: erreur instanceof MauvaisRoleError });
        });
      return () => {
        vivant = false;
      };
      // Une seule lecture par ENTRÉE sur l'écran : les photos en vol ne
      // doivent pas être balayées par une relecture (la liste est locale).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  const formulaire = useMemo(() => ({ points, photos, notes }), [points, photos, notes]);
  const manques = manquesDeLaPriseEnCharge(formulaire);

  /** Le premier manque, dit en toutes lettres. Jamais un bouton muet. */
  const phraseDuManque = (): string | null => {
    const manque = manques[0];
    if (manque === undefined) return null;
    if (manque.quoi === 'points') return t('missing.points', { count: manque.combien });
    if (manque.quoi === 'notes') return t('missing.notes', { count: manque.deTrop });
    return t(`missing.${manque.quoi}`);
  };

  /** Le refus du serveur, dit avec ses mots à lui quand il en a. */
  const echec = (erreur: unknown): string =>
    erreur instanceof ApiError && erreur.code === 'TRANSITION_NOT_ALLOWED'
      ? t('dealChanged')
      : t('failed');

  const envoyer = useCallback(async () => {
    const corps = corpsDeLaPriseEnCharge(formulaire);
    // Pas de bouton désactivé (A209) : il dit ce qui manque.
    if (corps === null) {
      setMontrerLesManques(true);
      return;
    }
    setEnvoi(true);
    setErreurEnvoi(null);
    try {
      await prendreEnCharge(id ?? '', corps);
      // On revient à la demande : elle relit à chaque retour et montrera
      // « pris en charge ». Rester ici n'aurait rien à proposer.
      setConfirme(true);
    } catch (erreur) {
      setErreurEnvoi(echec(erreur));
    } finally {
      setEnvoi(false);
    }
    // `echec` et `t` sont stables le temps d'un rendu ; les dépendances
    // utiles sont le formulaire et l'identifiant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulaire, id]);

  const refuser = useCallback(async () => {
    setRefusEnCours(true);
    setErreurEnvoi(null);
    try {
      await refuserLaPriseEnCharge(id ?? '', raison);
      setRefusOuvert(false);
      setRefuse(true);
    } catch (erreur) {
      setErreurEnvoi(echec(erreur));
    } finally {
      setRefusEnCours(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, raison]);

  const entete = (titre: string) => (
    <View
      style={[
        styles.entete,
        { borderBottomColor: theme.backgroundElement, paddingTop: topInset + Spacing.two },
      ]}>
      <BackButton label={t('back')} onPress={() => router.back()} />
      <ThemedText type="subtitle" style={styles.titre}>
        {titre}
      </ThemedText>
    </View>
  );

  /* ── Issue : le colis est pris en charge, ou refusé ───────────────────── */
  if (confirme || refuse) {
    return (
      <ThemedView style={styles.ecran}>
        <SafeAreaView style={styles.colonne} edges={['left', 'right']}>
          {entete(t('title'))}
          <View style={styles.centre}>
            <Ionicons
              name={confirme ? 'checkmark-circle-outline' : 'close-circle-outline'}
              size={44}
              color={theme.text}
            />
            <ThemedText type="subtitle" style={styles.centreTexte}>
              {confirme ? t('afterTitle') : t('refused')}
            </ThemedText>
            {confirme ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
                {t('afterBody')}
              </ThemedText>
            ) : null}
            <Action label={t('keep')} tone="primary" onPressAction={() => router.back()} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (etat.phase === 'chargement' || etat.phase === 'erreur') {
    return (
      <ThemedView style={styles.ecran}>
        <SafeAreaView style={styles.colonne} edges={['left', 'right']}>
          {entete(t('title'))}
          <View style={styles.centre}>
            {etat.phase === 'chargement' ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
                  {etat.mauvaisRole ? t('wrongRole') : t('loadError')}
                </ThemedText>
                <Action label={t('keep')} tone="neutral" onPressAction={() => router.back()} />
              </>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (etat.phase === 'interdite') {
    return (
      <ThemedView style={styles.ecran}>
        <SafeAreaView style={styles.colonne} edges={['left', 'right']}>
          {entete(t('title'))}
          <View style={styles.centre}>
            <ThemedText type="subtitle" style={styles.centreTexte}>
              {t('notAllowedTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
              {t('notAllowedBody')}
            </ThemedText>
            <Action label={t('keep')} tone="primary" onPressAction={() => router.back()} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { demande } = etat;
  const prenom = demande.expediteur.split(' ')[0] ?? '';
  const manque = montrerLesManques ? phraseDuManque() : null;

  return (
    <ThemedView style={styles.ecran}>
      <SafeAreaView style={styles.colonne} edges={['left', 'right']}>
        <KeyboardAvoidingView
          style={styles.remplit}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {entete(t('title'))}

          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
              {prenom.length > 0 ? t('intro', { name: prenom }) : t('introNoName')}
            </ThemedText>

            {/* ── Les cinq vérifications ───────────────────────────────── */}
            <Section title={t('checklistTitle')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('checklistWhy')}
              </ThemedText>
              {POINTS_INSPECTION.map((point) => (
                <Choice
                  key={point}
                  kind="check"
                  label={libelleDuPoint(point, demande.poidsKg, t)}
                  selected={points.includes(point)}
                  onToggleAction={() => setPoints((avant) => basculerPoint(avant, point))}
                />
              ))}
            </Section>

            {/* ── Les photos du colis ouvert ───────────────────────────── */}
            <Section title={t('photosTitle')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('photosWhy')}
              </ThemedText>
              {permissionRefusee !== null ? (
                <Notice icon="alert-circle-outline">
                  {`${t(
                    permissionRefusee === 'camera'
                      ? 'permissionCameraTitle'
                      : 'permissionLibraryTitle'
                  )} — ${t(
                    permissionRefusee === 'camera'
                      ? 'permissionCameraBody'
                      : 'permissionLibraryBody'
                  )}`}
                </Notice>
              ) : null}
              <PhotoShelf
                photos={photos}
                max={PHOTOS_MAX}
                textes={{
                  prendre: t('takePhoto'),
                  photothèque: t('fromLibrary'),
                  retirer: t('remove'),
                  reessayer: t('retry'),
                  echec: (code) => t(`uploadErrors.${code}`, { maxMb: PHOTO_MAX_MB }),
                }}
                onChoisirAction={(source) => {
                  setPermissionRefusee(null);
                  void choisir(source);
                }}
                onRetirerAction={retirer}
                onReessayerAction={reessayer}
              />
            </Section>

            {/* ── La remarque, facultative ─────────────────────────────── */}
            <Section title={t('notesTitle')}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={t('notesPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.zoneTexte,
                  { backgroundColor: theme.backgroundElement, color: theme.text },
                ]}
              />
              {/* Le compteur n'apparaît qu'une fois utile : un plafond de 500
                  annoncé sur un champ vide est un avertissement sans objet. */}
              {notes.trim().length > NOTES_MAX - 100 ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.compteur}>
                  {t('notesCounter', { count: notes.trim().length, max: NOTES_MAX })}
                </ThemedText>
              ) : null}
            </Section>

            {/* ── Le refus, en second mais VISIBLE ─────────────────────── */}
            <Section>
              <Action
                label={t('refuseLink')}
                tone="quiet"
                icon="close-circle-outline"
                onPressAction={() => {
                  setErreurEnvoi(null);
                  setRefusOuvert(true);
                }}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {t('refuseBody')}
              </ThemedText>
            </Section>
          </ScrollView>

          {/* ── La barre du bas : l'unique action attendue ─────────────── */}
          <View
            style={[
              styles.barre,
              {
                borderTopColor: theme.backgroundElement,
                paddingBottom: insets.bottom + Spacing.two,
              },
            ]}>
            {manque !== null ? (
              <ThemedText type="small" style={styles.manque}>
                {manque}
              </ThemedText>
            ) : null}
            {erreurEnvoi !== null ? (
              <ThemedText type="small" style={styles.manque}>
                {erreurEnvoi}
              </ThemedText>
            ) : null}
            <Action
              label={t('submit')}
              tone="primary"
              icon="cube-outline"
              pending={envoi}
              onPressAction={() => void envoyer()}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <FeuilleDeRefus
        visible={refusOuvert}
        raison={raison}
        pending={refusEnCours}
        erreur={erreurEnvoi}
        onChoisirAction={(choisie) => setRaison(choisie)}
        onConfirmerAction={() => void refuser()}
        onFermerAction={() => {
          if (refusEnCours) return;
          setRefusOuvert(false);
          setErreurEnvoi(null);
        }}
      />
    </ThemedView>
  );
}

/**
 * La feuille du REFUS. Pas la `ConfirmSheet` du kit : il y a cinq raisons à
 * choisir, et la feuille du kit ne porte que des lignes de texte.
 *
 * Le bouton qui CONFIRME n'est pas le plus visible : le geste est terminal
 * pour l'Expéditeur, c'est « revenir » qui porte le ton plein (même règle
 * que la feuille du kit).
 */
function FeuilleDeRefus({
  visible,
  raison,
  pending,
  erreur,
  onChoisirAction,
  onConfirmerAction,
  onFermerAction,
}: {
  visible: boolean;
  raison: RaisonRefus | null;
  pending: boolean;
  erreur: string | null;
  onChoisirAction: (raison: RaisonRefus | null) => void;
  onConfirmerAction: () => void;
  onFermerAction: () => void;
}) {
  const t = useTranslations('pickup');
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={pending ? undefined : onFermerAction}>
      <View style={styles.fond}>
        <Pressable
          style={styles.fondPlein}
          accessibilityRole="button"
          accessibilityLabel={t('keep')}
          onPress={pending ? undefined : onFermerAction}
        />
        <ThemedView style={[styles.feuille, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={[styles.poignee, { backgroundColor: theme.backgroundSelected }]} />
          <ThemedText type="subtitle">{t('refuseTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('refuseBody')}
          </ThemedText>

          <ScrollView style={styles.raisons} keyboardShouldPersistTaps="handled">
            {RAISONS_REFUS.map((code) => (
              <Choice
                key={code}
                label={t(`reasons.${code}`)}
                selected={raison === code}
                // Une raison reposée s'efface : sinon on ne peut plus revenir
                // à « sans préciser », qui est une réponse valable (A40).
                onToggleAction={() => onChoisirAction(raison === code ? null : code)}
              />
            ))}
            <ThemedText type="small" themeColor="textSecondary" style={styles.sansRaison}>
              {t('refuseNoReason')}
            </ThemedText>
          </ScrollView>

          {erreur !== null ? (
            <ThemedText type="small" style={styles.manque}>
              {erreur}
            </ThemedText>
          ) : null}

          <Action
            label={t('refuseConfirm')}
            tone="neutral"
            pending={pending}
            onPressAction={onConfirmerAction}
          />
          {pending ? null : (
            <Action label={t('keep')} tone="primary" onPressAction={onFermerAction} />
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

/**
 * Le libellé d'un point. Le POIDS n'est pas toujours servi (`pricing.weightKg`
 * peut manquer sur une réservation ancienne) : la phrase existe donc en deux
 * versions plutôt que d'afficher « ( kg) », qui ferait douter de la valeur.
 */
function libelleDuPoint(
  point: PointInspection,
  poidsKg: number | null,
  t: (cle: string, valeurs?: Record<string, string | number>) => string
): string {
  if (point !== 'WEIGHT_OK') return t(`items.${point}`);
  return poidsKg === null ? t('itemWeightUnknown') : t('items.WEIGHT_OK', { weight: poidsKg });
}

export default function PriseEnChargeScreen() {
  return (
    <IdentityGate destination="activity" onDismiss={() => router.back()}>
      <PriseEnChargeContent />
    </IdentityGate>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  colonne: { flex: 1, maxWidth: MaxContentWidth },
  remplit: { flex: 1 },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titre: { fontSize: 20 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  centreTexte: { textAlign: 'center' },
  page: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.one,
  },
  intro: { paddingTop: Spacing.three },
  zoneTexte: {
    minHeight: 96,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 15,
    lineHeight: 22,
  },
  compteur: { textAlign: 'right' },
  barre: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  manque: { color: '#DC2626' },

  fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  fondPlein: { flex: 1 },
  feuille: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  poignee: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  raisons: { maxHeight: 260 },
  sansRaison: { paddingTop: Spacing.two },
});
