/**
 * shipment/[id]/report.tsx — « Signaler un problème », côté Expéditeur.
 * =====================================================================
 * Le recours. Jusqu'ici la fiche de suivi DISAIT « si quelque chose ne va
 * pas, signale-le avant la fin du délai » (`next.delivered.three`) sans que
 * rien à l'écran ne permette de le faire : un Expéditeur dont le colis
 * arrivait abîmé n'avait aucun geste pendant les trois jours de vérification.
 * C'est exactement le défaut A203 — promettre un écran absent — et cet écran
 * le ferme en natif, sans jamais renvoyer au site (A210 b).
 *
 * Le jumeau web est `apps/user-ui/src/components/booking/booking-tracker/
 * views/report/` (dix composants, deux arbres). Même matière, autre
 * grammaire : une page à plat, des sections séparées par un filet, la barre
 * du bas pour l'unique action attendue. Les textes « courts » du site
 * (`*Short`) sont la bonne longueur ici.
 *
 * Le serveur décide de tout (RG-MOB-1) :
 *   • le DROIT de signaler — `dispute` ∈ `allowedActions`. Sans lui, l'écran
 *     ne montre pas un formulaire qu'on ne pourrait pas envoyer : il dit
 *     pourquoi et ramène au suivi ;
 *   • le MOTIF recevable — en transit, seul « jamais livré » (D51). L'écran
 *     n'affiche alors qu'un motif, déjà choisi, avec le bandeau qui explique ;
 *   • le NUMÉRO de dossier (`YAM-XXXX`), qui n'existe qu'après l'envoi.
 *
 * Les photos partent chez ImageKit DÈS la sélection (dossier `deals/dispute`,
 * D42) : au moment d'envoyer le dossier, il ne doit plus rien rester en vol —
 * `POST /deals/:id/dispute` n'accepte que des URL. Un téléversement en échec
 * BLOQUE donc l'envoi au lieu de partir sans sa preuve (RG-P-13).
 *
 * Le geste est IRRÉVERSIBLE (INV-4) et il gèle le paiement d'une vraie
 * personne : il passe par la feuille de confirmation, qui porte l'engagement
 * en toutes lettres.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import {
  Action,
  Choice,
  ConfirmSheet,
  Notice,
  Section,
  ShipmentTopBar,
  Steps,
} from '@/components/shipment/shipment-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { submitDispute } from '@/lib/api/dispute.api';
import {
  getShipment,
  WrongViewerRoleError,
  type ShipperShipmentDto,
} from '@/lib/api/shipment.api';
import { PHOTO_MAX_MB, uploadDisputePhoto } from '@/lib/api/upload.api';
import {
  allowedCategories,
  canSubmitReport,
  categoryLocked,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  describeDescription,
  DISPUTE_DESIRED_OUTCOMES,
  PHOTOS_MAX,
  photoSlotsLeft,
  reportBlockers,
  reportFailureKey,
  type DisputeCategory,
  type DisputeDesiredOutcome,
  type ReportPhoto,
} from '@/lib/report-form';
import { shipmentReference } from '@/lib/shipment-view';
import { formatPrice } from '@/lib/trip-format';

/** L'URI locale est unique sur l'appareil, et c'est la seule identité d'une
 *  photo avant qu'ImageKit lui en donne une. */
function photoId(asset: ImagePicker.ImagePickerAsset): string {
  return asset.assetId ?? asset.uri;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'wrongRole' }
  /** Le serveur n'autorise pas le geste : délai passé, dossier déjà ouvert,
   *  colis pas encore remis. On l'explique, on ne rend pas le formulaire. */
  | { kind: 'notAllowed' }
  | { kind: 'error'; correlationId: string | null }
  | { kind: 'loaded'; shipment: ShipperShipmentDto };

export default function ShipmentReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('shipment');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [outcome, setOutcome] = useState<DisputeDesiredOutcome | null>(null);
  const [pledgeAccepted, setPledgeAccepted] = useState(false);
  /** Les manques ne s'affichent qu'APRÈS une tentative d'envoi : rougir un
   *  formulaire vide à l'ouverture est une agression, pas une aide. */
  const [showBlockers, setShowBlockers] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  /** Un refus que réessayer ne changera pas (le deal a bougé, le motif n'est
   *  plus recevable) : le formulaire n'a plus d'objet, et le laisser ouvert
   *  invite à cogner contre un mur. */
  const [fatal, setFatal] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setState({ kind: 'notFound' });
      return;
    }
    let alive = true;
    getShipment(id)
      .then((shipment) => {
        if (!alive) return;
        if (!shipment.allowedActions.includes('dispute')) {
          setState({ kind: 'notAllowed' });
          return;
        }
        // D51 — en transit, le motif est imposé : on le pose tout de suite
        // pour que la case soit déjà cochée quand l'écran s'ouvre.
        if (categoryLocked(shipment.status)) setCategory(allowedCategories(shipment.status)[0]);
        setState({ kind: 'loaded', shipment });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        if (error instanceof WrongViewerRoleError) setState({ kind: 'wrongRole' });
        // 404 = inexistant OU pas à toi : indiscernables à dessein.
        else if (error instanceof ApiError && (error.status === 404 || error.status === 403))
          setState({ kind: 'notFound' });
        else if (error instanceof ApiError) setState({ kind: 'error', correlationId: error.correlationId });
        else setState({ kind: 'error', correlationId: null });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  /** Le retour au suivi. `back` quand il y a une pile (le cas normal :
   *  on arrive de la fiche), sinon la fiche elle-même. */
  const backToShipment = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/shipment/[id]', params: { id: id ?? '' } });
  }, [id]);

  /**
   * Une photo choisie part TOUT DE SUITE : elle apparaît en vol, puis en
   * ligne ou en échec. Sans ça, l'envoi du dossier devrait attendre cinq
   * téléversements d'un coup, au moment précis où l'Expéditeur a fini
   * d'écrire et appuie sur « Envoyer ».
   */
  const uploadOne = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    const key = photoId(asset);
    void uploadDisputePhoto({
      uri: asset.uri,
      // Gardés DÈS la sélection : l'asset d'origine n'est plus là ensuite.
      fileName: asset.fileName ?? null,
      mimeType: asset.mimeType ?? null,
      sizeBytes: asset.fileSize ?? null,
    }).then((result) => {
      setPhotos((previous) =>
        previous.map((p) =>
          p.id !== key
            ? p
            : result.ok
              ? { ...p, uploading: false, url: result.url, errorCode: null }
              : { ...p, uploading: false, url: null, errorCode: result.code }
        )
      );
    });
  }, []);

  const pickFrom = useCallback(
    async (source: 'camera' | 'library') => {
      const slots = photoSlotsLeft(photos);
      if (slots === 0) return;
      // La permission se demande AU GESTE, et séparément par source :
      // accepter l'appareil photo ne doit pas ouvrir toute la photothèque.
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t(source === 'camera' ? 'report.photos.cameraDeniedTitle' : 'report.photos.permissionTitle'),
          t(source === 'camera' ? 'report.photos.cameraDeniedBody' : 'report.photos.permissionBody')
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              selectionLimit: slots,
              allowsMultipleSelection: true,
            });
      if (result.canceled) return;

      const known = new Set(photos.map((p) => p.id));
      const chosen = result.assets.filter((asset) => !known.has(photoId(asset))).slice(0, slots);
      if (chosen.length === 0) return;
      setPhotos((previous) => [
        ...previous,
        ...chosen.map((asset) => ({
          id: photoId(asset),
          uri: asset.uri,
          uploading: true,
          url: null,
          errorCode: null,
        })),
      ]);
      for (const asset of chosen) uploadOne(asset);
    },
    [photos, t, uploadOne]
  );

  const addPhoto = useCallback(() => {
    // `Alert` plutôt qu'une feuille maison : c'est le sélecteur natif des
    // deux OS, donc familier et gratuit en accessibilité.
    Alert.alert(t('report.photos.add'), undefined, [
      { text: t('report.photos.camera'), onPress: () => void pickFrom('camera') },
      { text: t('report.photos.library'), onPress: () => void pickFrom('library') },
      { text: t('report.photos.cancel'), style: 'cancel' },
    ]);
  }, [pickFrom, t]);

  const removePhoto = useCallback((removedId: string) => {
    setPhotos((previous) => previous.filter((p) => p.id !== removedId));
  }, []);

  const send = useCallback(async () => {
    if (state.kind !== 'loaded' || category === null || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const result = await submitDispute(state.shipment.id, {
        category,
        description: description.trim(),
        photoUrls: photos.map((p) => p.url).filter((url): url is string => url !== null),
        ...(outcome ? { desiredOutcome: outcome } : {}),
      });
      setConfirming(false);
      setTicket(result.ticketNumber);
    } catch (error: unknown) {
      const key = reportFailureKey(
        error instanceof ApiError ? error.code : null,
        error instanceof ApiError ? error.status : 0
      );
      const message = t(`report.errors.${key}`);
      if (key === 'conflict' || key === 'categoryRefused') {
        // Définitif : on ferme la feuille et l'écran dit pourquoi, avec le
        // retour au suivi — qui relira l'état réel (rechargement au focus).
        setConfirming(false);
        setFatal(message);
      } else {
        // Réessayable (panne, validation) : le message se lit DANS la
        // feuille, qui reste ouverte sur le bouton d'envoi.
        setSendError(message);
      }
    } finally {
      setSending(false);
    }
  }, [state, category, description, photos, outcome, sending, t]);

  /* ── Les états qui ne montrent pas de formulaire ──────────────────────── */

  if (state.kind !== 'loaded' || ticket !== null || fatal !== null) {
    const shipment = state.kind === 'loaded' ? state.shipment : null;
    const carrierFirstName = shipment?.carrier.firstName?.trim() || t('carrier.title');

    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.page}>
            <ShipmentTopBar />
            {state.kind === 'loading' ? (
              <View style={styles.centeredBlock}>
                <ActivityIndicator color={Brand.mango} />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('loading')}
                </ThemedText>
              </View>
            ) : ticket !== null ? (
              /* Le dossier est ouvert : le numéro d'abord, parce que c'est
                 la seule chose à retenir de cet écran. */
              <View style={styles.centeredBlock}>
                <Ionicons name="shield-checkmark-outline" size={44} color={Brand.teal} />
                <ThemedText type="subtitle">{t('report.success.title')}</ThemedText>
                <ThemedText style={styles.ticket}>{t('report.success.ticket', { ticket })}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                  {t('report.success.body', { carrierFirstName })}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                  {t('report.success.keep')}
                </ThemedText>
                <Action
                  label={t('report.success.back')}
                  tone="primary"
                  onPressAction={backToShipment}
                />
              </View>
            ) : (
              <View style={styles.centeredBlock}>
                <ThemedText type="subtitle">
                  {t(
                    fatal !== null || state.kind === 'notAllowed'
                      ? 'report.notAllowed.title'
                      : state.kind === 'wrongRole'
                        ? 'wrongRole.title'
                        : state.kind === 'notFound'
                          ? 'notFound.title'
                          : 'error.title'
                  )}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                  {/* Le refus REÇU, mot pour mot, plutôt que le texte
                      générique : « le motif n'est plus recevable » et « le
                      délai est passé » ne se corrigent pas pareil. */}
                  {fatal ??
                    t(
                      state.kind === 'notAllowed'
                        ? 'report.notAllowed.body'
                        : state.kind === 'wrongRole'
                          ? 'wrongRole.body'
                          : state.kind === 'notFound'
                            ? 'notFound.body'
                            : 'error.body'
                    )}
                </ThemedText>
                {state.kind === 'error' && state.correlationId ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                    {t('error.reference', { id: state.correlationId })}
                  </ThemedText>
                ) : null}
                <Action
                  label={t('report.success.back')}
                  tone="primary"
                  onPressAction={backToShipment}
                />
              </View>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  /* ── Le formulaire ───────────────────────────────────────────────────── */

  const shipment = state.shipment;
  const carrierFirstName = shipment.carrier.firstName?.trim() || t('carrier.title');
  const recipientFirstName = shipment.recipient.firstName;
  const categories = allowedCategories(shipment.status);
  const locked = categoryLocked(shipment.status);
  const counter = describeDescription(description);
  const blockers = reportBlockers({ category, description, photos, outcome, pledgeAccepted });
  const ready = canSubmitReport({ category, description, photos, outcome, pledgeAccepted });

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.page, { paddingBottom: Spacing.five }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <ShipmentTopBar />

            <ThemedText type="title">{t('report.title')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('report.subtitle', {
                reference: shipmentReference(shipment.id),
                route: t('route', {
                  origin: shipment.trip.originCity,
                  destination: shipment.trip.destinationCity,
                }),
              })}
            </ThemedText>
            <View style={styles.intro}>
              <Notice icon="hand-left-outline">{t('report.intro', { carrierFirstName })}</Notice>
            </View>

            {/* ── Le motif ──────────────────────────────────────────────── */}
            <Section title={t('report.category.title')}>
              {locked ? (
                <Notice icon="airplane-outline">{t('report.category.locked')}</Notice>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('report.category.hint')}
                </ThemedText>
              )}
              {categories.map((id) => (
                <Choice
                  key={id}
                  label={t(`report.categories.${id}`, { recipientFirstName, carrierFirstName })}
                  selected={category === id}
                  onToggleAction={() => {
                    // Un motif imposé ne se décoche pas : il n'y a rien
                    // d'autre à choisir, et le vider bloquerait l'envoi.
                    if (!locked) setCategory(id);
                  }}
                />
              ))}
              {showBlockers && blockers.includes('category') ? (
                <ThemedText type="small" style={styles.blocker}>
                  {t('report.submit.blockers.category')}
                </ThemedText>
              ) : null}
            </Section>

            {/* ── Le récit ──────────────────────────────────────────────── */}
            <Section title={t('report.description.title')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('report.description.hint')}
              </ThemedText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={DESCRIPTION_MAX_LENGTH}
                textAlignVertical="top"
                placeholder={t('report.description.placeholder', { recipientFirstName })}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.textArea,
                  { color: theme.text, backgroundColor: theme.backgroundElement },
                ]}
                accessibilityLabel={t('report.description.title')}
              />
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={counter.ok ? undefined : showBlockers ? styles.blocker : undefined}>
                {counter.full
                  ? t('report.description.full', { max: DESCRIPTION_MAX_LENGTH })
                  : counter.ok
                    ? t('report.description.ok', { count: counter.length })
                    : t('report.description.missing', {
                        count: counter.missing,
                        min: DESCRIPTION_MIN_LENGTH,
                      })}
              </ThemedText>
            </Section>

            {/* ── Les preuves ───────────────────────────────────────────── */}
            <Section title={t('report.photos.title')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('report.photos.hint', { max: PHOTOS_MAX, maxMb: PHOTO_MAX_MB })}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('report.photos.ask', { recipientFirstName })}
              </ThemedText>
              {photos.length > 0 ? (
                <View style={styles.photoRow}>
                  {photos.map((photo) => (
                    <View key={photo.id} style={styles.photoBox}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
                      {photo.uploading ? (
                        <View style={styles.photoVeil}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        </View>
                      ) : null}
                      {photo.errorCode !== null ? (
                        <View style={[styles.photoVeil, styles.photoVeilError]}>
                          <Ionicons name="alert-circle-outline" size={20} color="#FFFFFF" />
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() => removePhoto(photo.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('report.photos.remove')}
                        style={styles.photoRemove}>
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              {photos.some((p) => p.uploading) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('report.photos.uploading')}
                </ThemedText>
              ) : null}
              {/* Le code d'échec est traduit ICI : ImageKit répondrait en
                  anglais, et son message n'est pas pour l'Expéditeur. */}
              {photos
                .filter((p) => p.errorCode !== null)
                .map((p) => (
                  <ThemedText key={`${p.id}-error`} type="small" style={styles.blocker}>
                    {t(`report.photos.errors.${p.errorCode}`, { maxMb: PHOTO_MAX_MB })}
                  </ThemedText>
                ))}
              {photoSlotsLeft(photos) > 0 ? (
                <Action label={t('report.photos.add')} icon="camera-outline" onPressAction={addPhoto} />
              ) : null}
            </Section>

            {/* ── La solution souhaitée (facultative) ───────────────────── */}
            <Section title={t('report.outcome.title')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('report.outcome.hint')}
              </ThemedText>
              {DISPUTE_DESIRED_OUTCOMES.map((id) => (
                <Choice
                  key={id}
                  label={t(`report.outcomes.${id}`, {
                    carrierFirstName,
                    // Le remboursement intégral porte un MONTANT : celui que
                    // l'Expéditeur a payé, pris dans l'instantané de prix
                    // (immuable, D17) — jamais recalculé ici.
                    amount: formatPrice(
                      shipment.pricing.totalShipperCents,
                      shipment.pricing.currencyCode,
                      locale
                    ),
                  })}
                  selected={outcome === id}
                  // Facultatif : un choix reposé s'efface, sinon on ne peut
                  // plus revenir à « je ne demande rien de précis ».
                  onToggleAction={() => setOutcome((current) => (current === id ? null : id))}
                />
              ))}
            </Section>

            {/* ── Ce qui se passe ensuite ────────────────────────────────── */}
            <Section title={t('report.process.title')}>
              <Steps
                items={['one', 'two', 'three', 'four'].map((n) =>
                  t(`report.process.${n}`, { carrierFirstName })
                )}
              />
            </Section>

            {/* ── L'engagement ──────────────────────────────────────────── */}
            <Section>
              <Choice
                kind="check"
                label={t('report.pledge.label')}
                selected={pledgeAccepted}
                onToggleAction={() => setPledgeAccepted((p) => !p)}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {t('report.pledge.why')}
              </ThemedText>
              {showBlockers && blockers.includes('pledge') ? (
                <ThemedText type="small" style={styles.blocker}>
                  {t('report.submit.blockers.pledge')}
                </ThemedText>
              ) : null}
            </Section>
          </ScrollView>

          {/* ── La barre du bas : l'unique action attendue ──────────────── */}
          <View
            style={[
              styles.bottomBar,
              {
                borderTopColor: theme.backgroundElement,
                paddingBottom: insets.bottom + Spacing.two,
              },
            ]}>
            {showBlockers && blockers.length > 0 ? (
              <ThemedText type="small" style={styles.blocker}>
                {t(`report.submit.blockers.${blockers[0]}`, {
                  count: counter.missing,
                  min: DESCRIPTION_MIN_LENGTH,
                })}
              </ThemedText>
            ) : null}
            <Action
              label={t('report.submit.label')}
              tone="primary"
              icon="paper-plane-outline"
              onPressAction={() => {
                // Pas de bouton désactivé (A209) : il dit ce qui manque.
                if (!ready) {
                  setShowBlockers(true);
                  return;
                }
                setSendError(null);
                setConfirming(true);
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ConfirmSheet
        visible={confirming}
        title={t('report.submit.confirmTitle')}
        lines={[
          t('report.submit.confirmBody', { carrierFirstName }),
          t('report.submit.confirmIrreversible'),
        ]}
        confirmLabel={t('report.submit.confirm')}
        keepLabel={t('report.submit.keep')}
        pendingLabel={t('report.submit.pending')}
        pending={sending}
        error={sendError}
        // Le geste est définitif : c'est « revenir » qui porte le ton plein.
        destructive
        onConfirmAction={() => void send()}
        onCancelAction={() => {
          if (sending) return;
          setConfirming(false);
          setSendError(null);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  page: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  centeredBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  centeredText: { textAlign: 'center' },
  ticket: { fontSize: 22, lineHeight: 30, fontWeight: 700, letterSpacing: 1 },
  intro: { paddingTop: Spacing.three },

  textArea: {
    minHeight: 132,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 15,
    lineHeight: 22,
  },
  blocker: { color: '#DC2626' },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photoBox: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoVeil: {
    // Les quatre côtés à la main : `StyleSheet.absoluteFillObject` n'existe
    // plus dans les typages de React Native 0.86.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoVeilError: { backgroundColor: 'rgba(220,38,38,0.55)' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  bottomBar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
