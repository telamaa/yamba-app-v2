/**
 * publish-trip/review.tsx — ⑥ VÉRIFIE ET PUBLIE (phase « Vérification »)
 * =======================================================================
 * Le dernier écran, et le seul qui ÉCRIVE quelque part. Il porte quatre
 * résumés, trois options, et le geste qui engage.
 *
 * CE QUI EST VOLONTAIRE ICI.
 *
 * ① Chaque bloc se MODIFIE sur place (`router.dismissTo`), c'est-à-dire en
 *    DÉPILANT jusqu'à l'écran concerné plutôt qu'en en poussant une seconde
 *    copie. Sans cela, « modifier le prix » puis « continuer » trois fois
 *    empilerait ④⑤⑥⑦ par-dessus ④⑤⑥⑦, et le retour deviendrait un couloir.
 *
 * ② Les options (main propre, réservation instantanée, mot aux Expéditeurs)
 *    vivent ICI et non dans un écran à elles : ce sont des réglages qu'on
 *    accepte par défaut, pas des décisions qui méritent un écran. Le site
 *    les plie d'ailleurs dans un accordéon « Options & message ».
 *
 * ③ Le refus du serveur est MONTRÉ, avec son code quand on sait le dire
 *    (`details.code`, A146). Les règles qui peuvent refuser ici ne sont pas
 *    devinables côté client — plafonds de confiance d'un compte neuf
 *    (CNF-06), compte restreint (D56) : le client ne les réimplémente pas,
 *    il les affiche.
 *
 * ④ Le brouillon n'est effacé qu'APRÈS un succès. Un échec réseau au dernier
 *    geste ne doit pas rendre six écrans de saisie.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { PublishStepFrame } from '@/components/publish/publish-step-frame';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { attacherLeBillet, publierLeTrajet } from '@/lib/api/publish.api';
import { PHOTO_MAX_MB, uploadTripTicket, type UploadFailureCode } from '@/lib/api/upload.api';
import { intlTagFor } from '@/lib/number-format';
import { formatAmountFromCents } from '@/lib/pricing-example';
import {
  clearPublishDraft,
  memoriserLeRetour,
  setPublishDraft,
  usePublishDraft,
} from '@/lib/publish-draft';
import { construireCorps } from '@/lib/publish-payload';
import { gainSiToutPartCents, manquesOffre } from '@/lib/publish-pricing';
import { FAMILLES, manquesDuTunnel } from '@/lib/publish-trip';
import { formatDayMonth } from '@/lib/trip-format';

/** Les refus que l'écran sait NOMMER ; les autres gardent la phrase générique. */
const CODES_CONNUS = ['NEW_ACCOUNT_CAP', 'ACCOUNT_RESTRICTED'] as const;

export default function PublishReviewScreen() {
  const t = useTranslations('publish');
  const tFamilles = useTranslations('search');
  const locale = useLocale() as SupportedLocale;
  const tag = intlTagFor(locale);
  const theme = useTheme();
  const draft = usePublishDraft();

  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [envoiDuBillet, setEnvoiDuBillet] = useState(false);
  const [erreurDuBillet, setErreurDuBillet] = useState<UploadFailureCode | null>(null);
  const [montreLesManques, setMontreLesManques] = useState(false);

  /**
   * Ce qui manque encore, TOUS écrans confondus.
   *
   * Le bouton reste actif (A209) et nomme ce qui manque — mais il ne part
   * plus au serveur pour se faire refuser : les six premiers écrans ont déjà
   * posé ces règles, les rejouer ici ne coûte rien et évite un aller-retour
   * dont le message serait en anglais et technique.
   */
  const manques = [...manquesDuTunnel(draft, new Date()), ...manquesOffre(draft)];

  const gainCents = gainSiToutPartCents(draft.prixParKiloEur, draft.capaciteKg);
  const refusees = FAMILLES.filter((f) => draft.familles[f].mode === 'REFUSE');
  const surtaxees = FAMILLES.filter((f) => draft.familles[f].mode === 'SURCHARGE');

  /**
   * Le billet part dès qu'il est choisi, PAS au moment de publier.
   *
   * Un échec d'image doit se voir là où on l'ajoute — sous le bouton
   * « Publier », il obligerait à choisir entre publier sans billet et tout
   * reprendre. Ici, il suffit d'en choisir un autre.
   */
  const choisirLeBillet = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('ticket.permissionTitle'), t('ticket.permissionBody'));
      return;
    }
    const choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (choix.canceled) return;
    const asset = choix.assets[0];
    if (!asset) return;

    setErreurDuBillet(null);
    setEnvoiDuBillet(true);
    const resultat = await uploadTripTicket({
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
      sizeBytes: asset.fileSize ?? null,
    });
    setEnvoiDuBillet(false);
    if (resultat.ok) setPublishDraft({ billet: resultat.document });
    else setErreurDuBillet(resultat.code);
  }, [t]);

  const publier = useCallback(async () => {
    if (manques.length > 0) {
      setMontreLesManques(true);
      return;
    }
    setMontreLesManques(false);
    setEnvoiEnCours(true);
    setRefus(null);
    try {
      const trajet = await publierLeTrajet(construireCorps(draft, true));
      // L'ordre compte. On MÉMORISE le retour (villes et lieux inversés) avant
      // d'effacer le brouillon — sans quoi l'écran de fin n'aurait plus rien à
      // proposer ; on efface APRÈS le succès ; et on REMPLACE l'écran, parce
      // que revenir en arrière sur un tunnel terminé n'a aucun sens.
      // Le billet s'attache APRÈS : le serveur le range sous l'id du trajet.
      // Un échec ici laisse un trajet EN LIGNE sans badge — c'est le bon sens
      // de l'échec, et l'écran de fin le DIT plutôt que de le taire.
      const billetJoint =
        draft.billet === null ? null : await attacherLeBillet(trajet.id, draft.billet);
      memoriserLeRetour(draft);
      clearPublishDraft();
      router.replace({
        pathname: '/publish-trip/done',
        params: { id: trajet.id, ...(billetJoint === false ? { billet: 'ko' } : {}) },
      });
    } catch (erreur) {
      const code = erreur instanceof ApiError ? erreur.code : null;
      setRefus(code !== null && (CODES_CONNUS as readonly string[]).includes(code) ? code : null);
      setEnvoiEnCours(false);
    }
  }, [draft, manques.length]);

  return (
    <PublishStepFrame
      title={t('review.title')}
      step={6}
      valueLabel={
        gainCents === null ? t('bar.newTrip') : `${formatAmountFromCents(gainCents, tag)} €`
      }
      valueHint={gainCents === null ? undefined : t('review.barHint')}
      ctaLabel={envoiEnCours ? t('review.publishing') : t('review.publish')}
      onContinueAction={() => {
        if (!envoiEnCours) void publier();
      }}>
      <Bloc
        titre={t('review.tripSection')}
        labelModifier={t('review.editTrip')}
        onEditAction={() => router.dismissTo('/publish-trip')}>
        <ThemedText type="smallBold">
          {draft.depart !== null && draft.arrivee !== null
            ? t('review.route', { from: draft.depart.ville, to: draft.arrivee.ville })
            : t('bar.newTrip')}
        </ThemedText>
        {/* « Samedi 28 novembre 2026 → Samedi 28 novembre 2026 » disait deux
            fois la même date sur deux lignes. Un récap tient sur une ligne :
            le jour, puis les deux heures — et le second jour n'apparaît que
            s'il est différent. */}
        <ThemedText type="small" themeColor="textSecondary">
          {draft.dateDepart === null || draft.dateArrivee === null
            ? t('review.datesMissing')
            : draft.dateDepart === draft.dateArrivee
              ? t('review.datesSameDay', {
                  date: formatDayMonth(new Date(`${draft.dateDepart}T12:00:00`), locale),
                  from: draft.heureDepart,
                  to: draft.heureArrivee,
                })
              : t('review.dates', {
                  from: `${formatDayMonth(new Date(`${draft.dateDepart}T12:00:00`), locale)} ${draft.heureDepart}`,
                  to: `${formatDayMonth(new Date(`${draft.dateArrivee}T12:00:00`), locale)} ${draft.heureArrivee}`,
                })}
        </ThemedText>
        {draft.mode !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t(`mode.${draft.mode}`)}
            {draft.sousType === null ? '' : ` · ${t(`mode.${draft.mode}_${draft.sousType}`)}`}
          </ThemedText>
        ) : null}
      </Bloc>

      <Bloc
        titre={t('review.offerSection')}
        labelModifier={t('review.editOffer')}
        onEditAction={() => router.dismissTo('/publish-trip/price')}>
        {/* Zéro est un MONTANT (« je transporte gratuitement ») ; l'absence
            n'en est pas un. Le premier jet affichait « 0,00 €/kg · 0 kg » là
            où la vérité était « tu n'as pas encore fixé » — vu au simulateur
            sur un brouillon vide. */}
        <ThemedText type="smallBold">
          {draft.prixParKiloEur === null || draft.capaciteKg === null
            ? t('review.offerMissing')
            : t('review.offer', {
                price: formatAmountFromCents(Math.round(draft.prixParKiloEur * 100), tag),
                capacity: draft.capaciteKg,
              })}
        </ThemedText>
        {gainCents !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('review.gain', { amount: formatAmountFromCents(gainCents, tag) })}
          </ThemedText>
        ) : null}
      </Bloc>

      <Bloc
        titre={t('review.conditionsSection')}
        labelModifier={t('review.editConditions')}
        onEditAction={() => router.dismissTo('/publish-trip/families')}>
        {refusees.length === 0 && surtaxees.length === 0 ? (
          <ThemedText type="small">{t('review.allAccepted')}</ThemedText>
        ) : (
          <>
            {refusees.length > 0 ? (
              <ThemedText type="small">
                {t('review.refused', {
                  list: refusees.map((f) => tFamilles(`families.${f}`)).join(' · '),
                })}
              </ThemedText>
            ) : null}
            {surtaxees.length > 0 ? (
              <ThemedText type="small">
                {surtaxees
                  .map(
                    (f) =>
                      `${tFamilles(`families.${f}`)} ${t('families.surchargeValue', {
                        pct: draft.familles[f].surchargePct,
                      })}`
                  )
                  .join(' · ')}
              </ThemedText>
            ) : null}
          </>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {draft.forfaitSouteEur === null && draft.forfaitCabineEur === null
            ? t('review.bagsNone')
            : t('review.bags', {
                list: [
                  draft.forfaitSouteEur === null
                    ? null
                    : `${t('families.checkedBag')} ${formatAmountFromCents(
                        Math.round(draft.forfaitSouteEur * 100),
                        tag
                      )} €`,
                  draft.forfaitCabineEur === null
                    ? null
                    : `${t('families.cabinBag')} ${formatAmountFromCents(
                        Math.round(draft.forfaitCabineEur * 100),
                        tag
                      )} €`,
                ]
                  .filter(Boolean)
                  .join(' · '),
              })}
        </ThemedText>
      </Bloc>

      <Bloc
        titre={t('review.placesSection')}
        labelModifier={t('review.editPlaces')}
        onEditAction={() => router.dismissTo('/publish-trip/places')}>
        <ThemedText type="small">
          {draft.lieuxRemise
            .filter((lieu) => lieu.actif)
            .map((lieu) => t(`places.${lieu.kind}`))
            .join(' · ') || '—'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {draft.lieuxLivraison
            .filter((lieu) => lieu.actif)
            .map((lieu) => t(`places.${lieu.kind}`))
            .join(' · ') || '—'}
        </ThemedText>
      </Bloc>

      {/* LE BILLET — déplacé ici depuis l'écran des dates (revue du 25/11).
          Il y vivait en bas, facultatif, facile à sauter, alors qu'il débloque
          le badge « Voyage vérifié », donc des réservations. Sa place est à
          côté de « Publier », quand le Voyageur est déjà engagé. */}
      <View style={styles.group}>
        <View style={styles.titreAvecMention}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('ticket.title')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('ticket.optional')}
          </ThemedText>
        </View>
        <View style={[styles.bloc, { borderColor: theme.backgroundElement }]}>
          <TextInput
            style={[styles.reference, { color: theme.text, borderColor: theme.backgroundElement }]}
            value={draft.reference}
            onChangeText={(reference) => setPublishDraft({ reference })}
            placeholder={t('ticket.referencePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={t('ticket.referenceLabel')}
          />

          {draft.billet !== null ? (
            <View style={styles.billet}>
              <Image source={{ uri: draft.billet.url }} style={styles.vignette} contentFit="cover" />
              <ThemedText type="small" style={styles.billetTexte}>
                {t('ticket.added')}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPublishDraft({ billet: null })}
                hitSlop={8}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('ticket.remove')}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={envoiDuBillet}
              onPress={() => void choisirLeBillet()}
              style={({ pressed }) => [styles.ajouter, pressed && styles.pressed]}>
              {envoiDuBillet ? (
                <ActivityIndicator size="small" color={Brand.mango} />
              ) : (
                <Ionicons name="image-outline" size={18} color={Brand.mango} />
              )}
              <ThemedText type="smallBold" style={{ color: Brand.mango }}>
                {envoiDuBillet ? t('ticket.uploading') : t('ticket.add')}
              </ThemedText>
            </Pressable>
          )}

          {erreurDuBillet !== null ? (
            <ThemedText type="small" style={{ color: Brand.mango }}>
              {t(`ticket.error${erreurDuBillet}`, { max: PHOTO_MAX_MB })}
            </ThemedText>
          ) : null}

          <ThemedText type="small" themeColor="textSecondary">
            {t('ticket.hint')}
          </ThemedText>
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('review.optionsSection')}
        </ThemedText>
        <View style={[styles.bloc, { borderColor: theme.backgroundElement }]}>
          <Option
            titre={t('review.handDelivery')}
            aide={t('review.handDeliveryHint')}
            valeur={draft.remiseEnMainPropre}
            onChangeAction={(remiseEnMainPropre) => setPublishDraft({ remiseEnMainPropre })}
          />
          <View style={[styles.filet, { backgroundColor: theme.backgroundElement }]} />
          <Option
            titre={t('review.instantBooking')}
            aide={t('review.instantBookingHint')}
            valeur={draft.reservationInstantanee}
            onChangeAction={(reservationInstantanee) =>
              setPublishDraft({ reservationInstantanee })
            }
          />
        </View>
      </View>

      <View style={styles.group}>
        <View style={styles.titreAvecMention}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('review.notesTitle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('review.notesOptional')}
          </ThemedText>
        </View>
        <TextInput
          style={[styles.notes, { color: theme.text, borderColor: theme.backgroundElement }]}
          value={draft.notes}
          onChangeText={(notes) => setPublishDraft({ notes })}
          placeholder={t('review.notesPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={2000}
          accessibilityLabel={t('review.notesTitle')}
        />
      </View>

      {envoiEnCours ? <ActivityIndicator color={Brand.mango} /> : null}

      {montreLesManques && manques.length > 0 ? (
        <View style={styles.refus}>
          <ThemedText type="smallBold" style={{ color: Brand.mango }}>
            {t('review.incompleteTitle')}
          </ThemedText>
          {manques.map((manque) => (
            <View key={manque} style={styles.manque}>
              <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
              <ThemedText type="small" style={{ color: Brand.mango }}>
                {t(`missing.${manque}`)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {refus !== null ? (
        <View style={styles.refus}>
          <ThemedText type="smallBold" style={{ color: Brand.mango }}>
            {t('review.errorTitle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(`review.error${refus}`)}
          </ThemedText>
        </View>
      ) : null}
    </PublishStepFrame>
  );

  function Bloc({
    titre,
    labelModifier,
    onEditAction,
    children,
  }: {
    titre: string;
    labelModifier: string;
    onEditAction: () => void;
    children: ReactNode;
  }) {
    return (
      <View style={styles.group}>
        <View style={styles.titreAvecMention}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {titre}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labelModifier}
            onPress={onEditAction}
            hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: Brand.mango }}>
              {t('review.edit')}
            </ThemedText>
          </Pressable>
        </View>
        <View style={[styles.bloc, { borderColor: theme.backgroundElement }]}>{children}</View>
      </View>
    );
  }

  function Option({
    titre,
    aide,
    valeur,
    onChangeAction,
  }: {
    titre: string;
    aide: string;
    valeur: boolean;
    onChangeAction: (valeur: boolean) => void;
  }) {
    return (
      <View style={styles.option}>
        <View style={styles.optionTextes}>
          <ThemedText type="smallBold">{titre}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {aide}
          </ThemedText>
        </View>
        <Switch
          value={valeur}
          onValueChange={onChangeAction}
          trackColor={{ true: Brand.mango, false: theme.backgroundSelected }}
          accessibilityLabel={titre}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  bloc: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  filet: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  titreAvecMention: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  optionTextes: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reference: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    fontSize: 15,
  },
  ajouter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  billet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  vignette: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  billetTexte: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  notes: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    minHeight: 96,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  refus: {
    gap: Spacing.one,
  },
  manque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
