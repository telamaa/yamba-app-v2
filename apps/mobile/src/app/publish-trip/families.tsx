/**
 * publish-trip/families.tsx — ④ CE QUE TU ACCEPTES (phase « Conditions »)
 * ========================================================================
 * Les huit familles de risque (D14 / CAT-02) et les deux forfaits « bagage
 * entier » (PRC-04), sur un écran.
 *
 * LE GESTE. Le site plie tout cela dans un accordéon « Ajuster » qui s'ouvre
 * sur un tableau. Au pouce, un tableau de huit lignes × trois choix est
 * injouable s'il faut viser une case ; mais un contrôle qui CYCLE entre trois
 * états au tap (accepté → surtaxé → refusé) serait pire : rien à l'écran ne
 * dit qu'il cycle, et il faut taper deux fois pour revenir. Chaque ligne
 * porte donc ses TROIS choix, visibles, en pastilles de 44 pt.
 *
 * LE DÉFAUT PAR DÉFAUT. Les huit familles partent ACCEPTÉES : refuser est un
 * choix, pas un état initial — un Voyageur qui ne touche à rien publie une
 * annonce ouverte, et c'est ce que le serveur comprend d'une liste vide
 * (`familyConditions` : seules les familles ≠ ACCEPT voyagent).
 *
 * LES LIBELLÉS NE SONT PAS RECOPIÉS. Ils vivent déjà dans le dictionnaire
 * `search.families.*` (et la fiche de D102 les compare mot pour mot à ceux du
 * site). Une quatrième copie ici, c'est une quatrième occasion de diverger —
 * on lit l'espace de noms voisin.
 *
 * RG-B-29 — un forfait dont la franchise dépasse la capacité est SUSPENDU :
 * ni envoyé, ni effacé. L'écran le DIT, avec les deux nombres, au lieu de
 * griser un champ sans raison.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import { NumberStepper } from '@/components/publish/number-stepper';
import { PublishStepFrame } from '@/components/publish/publish-step-frame';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { intlTagFor } from '@/lib/number-format';
import { formatMoneyFromCents, formatPerKg } from '@/lib/pricing-example';
import { setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import { sauvegarderLeBrouillon } from '@/lib/publish-sauvegarde';
import {
  FRANCHISE_CABINE_KG,
  FRANCHISE_SOUTE_KG,
  cranSurcharge,
  forfaitActif,
  forfaitParKilo,
  gainSiToutPartCents,
  peutCranerSurcharge,
} from '@/lib/publish-pricing';
import { FAMILLES, SURCHARGE_PAR_DEFAUT, type FamilyMode, type ParcelFamily } from '@/lib/publish-trip';

const MODES_DE_FAMILLE: readonly FamilyMode[] = ['ACCEPT', 'SURCHARGE', 'REFUSE'];
const CLE_DE_MODE: Record<FamilyMode, string> = {
  ACCEPT: 'accept',
  SURCHARGE: 'surcharge',
  REFUSE: 'refuse',
};

export default function PublishFamiliesScreen() {
  const t = useTranslations('publish');
  const tFamilles = useTranslations('search');
  const locale = useLocale();
  const tag = intlTagFor(locale);
  const theme = useTheme();
  const draft = usePublishDraft();

  const onContinue = useCallback(() => {
    // Rien n'est obligatoire ici : tout accepter EST une réponse valable.
    // D111 quater — l'état part au serveur à chaque écran franchi, SANS
    // attendre : la navigation ne dépend pas du réseau (le brouillon local
    // reste la copie de travail).
    void sauvegarderLeBrouillon();
    router.push('/publish-trip/places');
  }, []);

  const changerMode = useCallback(
    (famille: ParcelFamily, mode: FamilyMode) => {
      const courant = draft.familles[famille];
      setPublishDraft({
        familles: {
          ...draft.familles,
          // Le pourcentage est MÉMORISÉ même hors du mode « supplément » :
          // rebasculer ne doit pas effacer ce qu'on avait réglé.
          [famille]: { mode, surchargePct: courant?.surchargePct ?? SURCHARGE_PAR_DEFAUT },
        },
      });
    },
    [draft.familles]
  );

  const changerSurcharge = useCallback(
    (famille: ParcelFamily, pct: number) => {
      setPublishDraft({
        familles: { ...draft.familles, [famille]: { mode: 'SURCHARGE', surchargePct: pct } },
      });
    },
    [draft.familles]
  );

  const refusees = FAMILLES.filter((f) => draft.familles[f].mode === 'REFUSE').length;
  const surtaxees = FAMILLES.filter((f) => draft.familles[f].mode === 'SURCHARGE').length;

  /**
   * HUIT CARTES REPLIÉES PAR DÉFAUT.
   *
   * Le cas courant est « je prends tout » : dérouler huit cartes identiques
   * pour ne rien y changer, c'est un écran de défilement pour rien. Le site
   * plie d'ailleurs la même chose derrière « Ajuster ».
   *
   * Replié ne veut pas dire caché : la ligne au-dessus DIT l'état (« Tout
   * accepté », ou le compte des exceptions), et tout écart déplie d'office —
   * on ne replie jamais une décision déjà prise.
   */
  const [deplie, setDeplie] = useState(refusees > 0 || surtaxees > 0);
  const gainCents = gainSiToutPartCents(draft.prixParKiloEur, draft.capaciteKg);

  const souteActif = forfaitActif(draft.forfaitSouteEur, FRANCHISE_SOUTE_KG, draft.capaciteKg);
  const cabineActif = forfaitActif(draft.forfaitCabineEur, FRANCHISE_CABINE_KG, draft.capaciteKg);

  return (
    <PublishStepFrame
      title={t('families.title')}
      step={4}
      valueLabel={
        gainCents === null ? t('bar.newTrip') : formatMoneyFromCents(gainCents, tag)
      }
      valueHint={gainCents === null ? undefined : t('price.gainBarHint')}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      {/* Un compte s'écrit au pluriel de sa langue, pas avec « (s) » —
          « 1 refusée(s), 1 avec supplément » était la phrase d'un formulaire
          administratif. Deux clés ICU, jointes seulement si les deux comptent. */}
      <ThemedText type="small" themeColor="textSecondary">
        {refusees === 0 && surtaxees === 0
          ? t('families.allAccepted')
          : [
              refusees > 0 ? t('families.refusedCount', { count: refusees }) : null,
              surtaxees > 0 ? t('families.surchargedCount', { count: surtaxees }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
      </ThemedText>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: deplie }}
        onPress={() => setDeplie((ouvert) => !ouvert)}
        style={({ pressed }) => [styles.bascule, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={{ color: Brand.mango }}>
          {deplie ? t('families.hide') : t('families.adjust')}
        </ThemedText>
        <Ionicons name={deplie ? 'chevron-up' : 'chevron-down'} size={15} color={Brand.mango} />
      </Pressable>

      <View style={[styles.liste, deplie ? null : styles.replie]}>
        {deplie ? FAMILLES.map((famille) => {
          const condition = draft.familles[famille];
          return (
            <View
              key={famille}
              style={[styles.carteFamille, { borderColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{tFamilles(`families.${famille}`)}</ThemedText>
              <View style={styles.choix}>
                {MODES_DE_FAMILLE.map((mode) => {
                  const actif = condition.mode === mode;
                  return (
                    <Pressable
                      key={mode}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: actif }}
                      accessibilityLabel={`${tFamilles(`families.${famille}`)} — ${t(
                        `families.${CLE_DE_MODE[mode]}`
                      )}`}
                      onPress={() => changerMode(famille, mode)}
                      style={({ pressed }) => [
                        styles.pastille,
                        {
                          borderColor: actif ? Brand.mango : theme.backgroundElement,
                          backgroundColor: actif ? theme.backgroundElement : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <ThemedText type={actif ? 'smallBold' : 'small'}>
                        {mode === 'SURCHARGE' && actif
                          ? t('families.surchargeValue', { pct: condition.surchargePct })
                          : t(`families.${CLE_DE_MODE[mode]}`)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {condition.mode === 'SURCHARGE' ? (
                <NumberStepper
                  valeur={t('families.surchargeValue', { pct: condition.surchargePct })}
                  unite=""
                  peutMonter={peutCranerSurcharge(condition.surchargePct, 1)}
                  peutDescendre={peutCranerSurcharge(condition.surchargePct, -1)}
                  labelMoins={t('families.stepDownSurcharge')}
                  labelPlus={t('families.stepUpSurcharge')}
                  nomDeLaValeur={t('families.surchargeName', { pct: condition.surchargePct })}
                  onStepAction={(sens) =>
                    changerSurcharge(famille, cranSurcharge(condition.surchargePct, sens))
                  }
                />
              ) : null}
            </View>
          );
        }) : null}
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('families.bagsTitle')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('families.bagsSubtitle')}
        </ThemedText>
        <View style={[styles.carteFamille, { borderColor: theme.backgroundElement }]}>
          <LigneForfait
            nom={t('families.checkedBag')}
            franchiseKg={FRANCHISE_SOUTE_KG}
            valeur={draft.forfaitSouteEur}
            actif={souteActif}
            onChangeAction={(forfaitSouteEur) => setPublishDraft({ forfaitSouteEur })}
          />
          <View style={[styles.filet, { backgroundColor: theme.backgroundElement }]} />
          <LigneForfait
            nom={t('families.cabinBag')}
            franchiseKg={FRANCHISE_CABINE_KG}
            valeur={draft.forfaitCabineEur}
            actif={cabineActif}
            onChangeAction={(forfaitCabineEur) => setPublishDraft({ forfaitCabineEur })}
          />
        </View>
      </View>
    </PublishStepFrame>
  );

  function LigneForfait({
    nom,
    franchiseKg,
    valeur,
    actif,
    onChangeAction,
  }: {
    nom: string;
    franchiseKg: number;
    valeur: number | null;
    actif: boolean;
    onChangeAction: (prix: number | null) => void;
  }) {
    const parKilo = forfaitParKilo(valeur, franchiseKg);
    // Capacité insuffisante : le forfait est SUSPENDU, pas fautif (RG-B-29).
    const suspendu = valeur !== null && valeur > 0 && !actif;

    return (
      <View style={styles.ligneForfait}>
        <View style={styles.ligneForfaitTetes}>
          <View style={styles.ligneForfaitTextes}>
            <ThemedText type="smallBold">{nom}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('families.bagFranchise', { kg: franchiseKg })}
            </ThemedText>
          </View>
          <TextInput
            style={[styles.prix, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            value={valeur === null ? '' : String(valeur)}
            onChangeText={(saisie) => {
              const chiffres = saisie.replace(/[^0-9]/g, '').slice(0, 4);
              onChangeAction(chiffres === '' ? null : Number(chiffres));
            }}
            placeholder={t('families.bagPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            accessibilityLabel={nom}
          />
        </View>
        {parKilo !== null && !suspendu ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('families.bagPerKg', { value: formatPerKg(parKilo, tag) })}
          </ThemedText>
        ) : null}
        {suspendu ? (
          <View style={styles.manque}>
            <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
            <ThemedText type="small" style={{ color: Brand.mango }}>
              {t('families.bagSuspended', { kg: franchiseKg })}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  liste: {
    gap: Spacing.two,
  },
  replie: {
    display: 'none',
  },
  bascule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    marginTop: -Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  group: {
    gap: Spacing.two,
  },
  carteFamille: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  choix: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pastille: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filet: {
    height: StyleSheet.hairlineWidth,
  },
  ligneForfait: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  ligneForfaitTetes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  ligneForfaitTextes: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  prix: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    minWidth: 96,
    minHeight: 44,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 24,
  },
  manque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
