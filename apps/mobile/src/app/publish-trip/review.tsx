/**
 * publish-trip/review.tsx — ⑦ VÉRIFIE ET PUBLIE (phase « Vérification »)
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
 *    geste ne doit pas rendre sept écrans de saisie.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { PublishStepFrame } from '@/components/publish/publish-step-frame';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { publierLeTrajet } from '@/lib/api/publish.api';
import { intlTagFor } from '@/lib/number-format';
import { formatAmountFromCents } from '@/lib/pricing-example';
import { clearPublishDraft, setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import { construireCorps } from '@/lib/publish-payload';
import { gainSiToutPartCents, manquesOffre } from '@/lib/publish-pricing';
import { FAMILLES, manquesDuTunnel } from '@/lib/publish-trip';
import { formatLongDate } from '@/lib/trip-format';

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
      // L'ordre compte : on efface APRÈS le succès, et on REMPLACE l'écran —
      // revenir en arrière sur un tunnel terminé n'a aucun sens.
      clearPublishDraft();
      router.replace({ pathname: '/trip/[id]', params: { id: trajet.id } });
    } catch (erreur) {
      const code = erreur instanceof ApiError ? erreur.code : null;
      setRefus(code !== null && (CODES_CONNUS as readonly string[]).includes(code) ? code : null);
      setEnvoiEnCours(false);
    }
  }, [draft, manques.length]);

  return (
    <PublishStepFrame
      title={t('review.title')}
      subtitle={t('review.subtitle')}
      step={7}
      valueLabel={
        gainCents === null ? t('bar.newTrip') : `${formatAmountFromCents(gainCents, tag)} €`
      }
      valueHint={gainCents === null ? t('bar.gainLater') : t('review.barHint')}
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
        <ThemedText type="small" themeColor="textSecondary">
          {draft.dateDepart === null || draft.dateArrivee === null
            ? t('review.datesMissing')
            : t('review.dates', {
                from: formatLongDate(`${draft.dateDepart}T12:00:00`, locale),
                to: formatLongDate(`${draft.dateArrivee}T12:00:00`, locale),
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
                {refusees.map((f) => tFamilles(`families.${f}`)).join(' · ')}
                {` — ${t('families.refuse').toLocaleLowerCase(locale)}`}
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
