/**
 * publish-trip/price.tsx — ③ TON PRIX ET TES KILOS (phase « Conditions »)
 * ========================================================================
 * L'écran qui décide du revenu. Il tient en deux réglages et une promesse :
 * ce que tu annonces est ce que tu touches (D16 — le prix du Voyageur EST
 * son net, la commission est payée par l'Expéditeur).
 *
 * TROIS PARTIS PRIS.
 *
 * ① Le geste est un PAS-À-PAS, pas un curseur (doctrine A207 / D101 2A) :
 *    le pourquoi est dans `components/publish/number-stepper.tsx`.
 *
 * ② Le gain est PERMANENT, dans la barre du bas, et il se met à jour à
 *    chaque cran. C'est le pendant exact de la barre de réservation, où le
 *    prix bouge à chaque choix : ici chaque choix RAPPORTE, et on le voit
 *    rapporter. Un Voyageur qui ne voit pas ce que son tarif produit n'a
 *    aucune raison de le monter.
 *
 * ③ CE QUI N'EST PAS LÀ, ET POURQUOI — la fourchette du marché. Le site
 *    affiche une jauge « prix juste » (basse / médiane / haute) calculée par
 *    corridor : `suggestPricePerKg` a besoin du CODE PAYS et des
 *    COORDONNÉES des deux villes. Le relais Places (A211) ne rend ni l'un ni
 *    l'autre — il ne sert que deux chaînes (`CitySuggestion`). Afficher la
 *    jauge quand même, c'est montrer la MÊME médiane sur tous les corridors,
 *    c'est-à-dire un repère qui a l'air d'en être un : exactement le défaut
 *    de D100. Elle arrivera quand le relais rendra le pays (décision à
 *    prendre : `/places/details` avec le même jeton de session, facturé dans
 *    la session Google, ou le code pays ajouté à l'autocomplétion).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import { NumberStepper, ValeursUsuelles } from '@/components/publish/number-stepper';
import { PublishStepFrame } from '@/components/publish/publish-step-frame';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { intlTagFor } from '@/lib/number-format';
import { BILLING_FLOOR_KG, formatAmountFromCents } from '@/lib/pricing-example';
import { setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import {
  CAPACITES_USUELLES_KG,
  PRIX_USUELS_PAR_KG,
  cranCapacite,
  cranPrix,
  gainSiToutPartCents,
  manquesOffre,
  peutCranerCapacite,
  peutCranerPrix,
  rameneCapacite,
  ramenePrix,
} from '@/lib/publish-pricing';

/** Les valeurs d'ouverture : celles du site (12 kg), et le milieu du domaine. */
const PRIX_D_OUVERTURE = 10;
const CAPACITE_D_OUVERTURE = 12;

export default function PublishPriceScreen() {
  const t = useTranslations('publish');
  const locale = useLocale();
  const tag = intlTagFor(locale);
  const draft = usePublishDraft();
  const [montreLesManques, setMontreLesManques] = useState(false);

  /**
   * LES VALEURS D'OUVERTURE S'ÉCRIVENT DANS LE BROUILLON, à l'ouverture.
   *
   * Le premier jet les affichait sans les écrire : l'écran montrait
   * « 10,00 €/kg · 12 kg » pendant que le brouillon valait `null`, la barre
   * du bas disait « ton gain s'affichera ici », et « Continuer » reprochait
   * « fixe ton prix au kilo » juste sous un prix affiché. C'est le défaut
   * D99 3C mot pour mot — un contrôle qui montre une valeur qu'il n'applique
   * pas —, commis dans l'écran dont l'en-tête le cite. Vu au simulateur, pas
   * déduit : un effet d'interface se REGARDE (D98).
   *
   * CORRECTION DU 25/11 — j'avais écrit ici que « le site a exactement le
   * même défaut ». C'est FAUX, vérifié dans son code : `StepConditions.tsx`
   * écrit la médiane suggérée DANS le brouillon au montage (« D15 : la
   * suggestion guide, le Voyageur ajuste »). Le site avait raison, le défaut
   * était ici seul, et le correctif ci-dessous ne fait que rejoindre ce
   * qu'il faisait déjà.
   *
   * Écrire d'office n'est pas décider à la place : le septième écran REDIT
   * le prix et la capacité avant de publier.
   */
  useEffect(() => {
    const valeurs: { prixParKiloEur?: number; capaciteKg?: number } = {};
    if (draft.prixParKiloEur === null) valeurs.prixParKiloEur = PRIX_D_OUVERTURE;
    if (draft.capaciteKg === null) valeurs.capaciteKg = CAPACITE_D_OUVERTURE;
    if (Object.keys(valeurs).length > 0) setPublishDraft(valeurs);
    // Au montage seulement : une proposition d'ouverture, pas une règle qui
    // court pendant toute la vie de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prix = draft.prixParKiloEur ?? PRIX_D_OUVERTURE;
  const capacite = draft.capaciteKg ?? CAPACITE_D_OUVERTURE;

  const manques = manquesOffre(draft);

  const onContinue = useCallback(() => {
    if (manques.length > 0) {
      setMontreLesManques(true);
      return;
    }
    setMontreLesManques(false);
    router.push('/publish-trip/families');
  }, [manques.length]);

  const gainCents = gainSiToutPartCents(draft.prixParKiloEur, draft.capaciteKg);

  return (
    <PublishStepFrame
      title={t('price.title')}
      subtitle={t('price.subtitle')}
      step={3}
      valueLabel={
        gainCents === null ? t('bar.newTrip') : `${formatAmountFromCents(gainCents, tag)} €`
      }
      valueHint={gainCents === null ? undefined : t('price.gainBarHint')}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('price.perKgTitle')}
        </ThemedText>
        <NumberStepper
          valeur={formatAmountFromCents(Math.round(prix * 100), tag)}
          unite={t('price.perKgUnit')}
          peutMonter={peutCranerPrix(prix, 1)}
          peutDescendre={peutCranerPrix(prix, -1)}
          labelMoins={t('price.stepDownPrice')}
          labelPlus={t('price.stepUpPrice')}
          nomDeLaValeur={t('price.priceValue', {
            value: formatAmountFromCents(Math.round(prix * 100), tag),
          })}
          onStepAction={(sens) => setPublishDraft({ prixParKiloEur: cranPrix(prix, sens) })}
        />
        <ValeursUsuelles
          valeurs={PRIX_USUELS_PAR_KG}
          choisie={draft.prixParKiloEur}
          // « 8 €/kg » × 4 débordait sur deux lignes (le dernier orphelin).
          // L'unité est déjà sous le pas-à-pas : la pastille garde le symbole.
          libelle={(valeur) => `${valeur.toLocaleString(tag)} €`}
          onPickAction={(valeur) => setPublishDraft({ prixParKiloEur: ramenePrix(valeur) })}
        />
        {/* D81 — le plancher est en KILOS : c'est la seule formulation vraie
            sur tous les corridors, et elle appartient à l'écran où le tarif se
            règle (la carte de résultat, elle, ne doit ni la répéter ni la
            contredire — D99 bis). */}
        <ThemedText type="small" themeColor="textSecondary">
          {t('price.floorHint', { kg: BILLING_FLOOR_KG })}
        </ThemedText>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('price.capacityTitle')}
        </ThemedText>
        <NumberStepper
          valeur={capacite.toLocaleString(tag)}
          unite={t('price.kgUnit')}
          peutMonter={peutCranerCapacite(capacite, 1)}
          peutDescendre={peutCranerCapacite(capacite, -1)}
          labelMoins={t('price.stepDownCapacity')}
          labelPlus={t('price.stepUpCapacity')}
          nomDeLaValeur={t('price.capacityValue', { value: capacite.toLocaleString(tag) })}
          onStepAction={(sens) => setPublishDraft({ capaciteKg: cranCapacite(capacite, sens) })}
        />
        <ValeursUsuelles
          valeurs={CAPACITES_USUELLES_KG}
          choisie={draft.capaciteKg}
          libelle={(valeur) => `${valeur.toLocaleString(tag)} ${t('price.kgUnit')}`}
          onPickAction={(valeur) => setPublishDraft({ capaciteKg: rameneCapacite(valeur) })}
        />
      </View>

      {/* PAS de carte de gain ici : la barre du bas porte le même nombre, à
          120 px de là. Deux fois le même montant sur un écran, c'est du bruit
          — et c'est la barre qui gagne, parce qu'elle SUIT le pouce sur les
          quatre écrans suivants. */}

      {montreLesManques && manques.length > 0 ? (
        <View style={styles.manques}>
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
    </PublishStepFrame>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  manques: {
    gap: Spacing.one,
  },
  manque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
