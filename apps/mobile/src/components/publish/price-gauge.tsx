/**
 * price-gauge.tsx — la fourchette du marché, sous le tarif (D111 ter).
 * ======================================================================
 * Le site l'affiche depuis D15 ; le téléphone ne l'avait pas, faute de code
 * pays (le relais Places ne rendait que deux chaînes). Avec
 * `GET /places/details`, le corridor se lit — et le Voyageur cesse de fixer
 * son prix à l'aveugle.
 *
 * CE QUI EST MONTRÉ, ET POURQUOI SI PEU : une piste, un repère, une médiane,
 * un verdict. Le site affiche en plus un popover « Pourquoi ce prix ? » qui
 * détaille les modificateurs (corridor, vol direct, départ proche) ; sur un
 * téléphone, ce détail appartient à une page d'aide, pas à l'écran où l'on
 * règle un curseur. On garde ce qui change une décision : « tu es dans le
 * marché », « tu es en dessous ».
 *
 * CE QUI N'EST PAS MONTRÉ : rien, quand le corridor est inconnu. Une
 * médiane calculée sur la base de repli serait la MÊME sur tous les
 * corridors — un repère qui a l'air d'en être un, c'est-à-dire le défaut de
 * D100. L'écran se tait plutôt que d'inventer.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  positionSurLaJauge,
  verdictDePrix,
  type Fourchette,
} from '@/lib/publish-price-suggestion';

export function PriceGauge({
  prix,
  fourchette,
  marketLabel,
  verdictLabels,
  accessibilityLabel,
}: {
  prix: number;
  fourchette: Fourchette;
  /** « Marché : 9,28 €/kg », déjà mis en forme dans la langue du lecteur. */
  marketLabel: string;
  verdictLabels: { bas: string; juste: string; haut: string };
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const verdict = verdictDePrix(prix, fourchette);
  const position = positionSurLaJauge(prix, fourchette);

  // La zone « juste » est peinte EN TEAL, les deux bords restent neutres.
  // Un gris de remplissage sur un gris de piste, c'est 3 % d'écart de
  // luminance — le défaut mesuré de D88 ① sur la barre d'onglets : un
  // indicateur qu'on ne voit pas n'indique rien. Et le teal est déjà la
  // couleur du verdict « Prix juste » juste en dessous : la zone et le mot
  // se répondent.
  const debutJuste = positionSurLaJauge(fourchette.bas, fourchette);
  const finJuste = positionSurLaJauge(fourchette.haut, fourchette);

  return (
    <View style={styles.bloc} accessible accessibilityLabel={accessibilityLabel}>
      <View style={[styles.piste, { backgroundColor: theme.backgroundElement }]}>
        <View
          style={[
            styles.zoneJuste,
            {
              left: `${debutJuste * 100}%`,
              width: `${Math.max(finJuste - debutJuste, 0) * 100}%`,
              backgroundColor: theme.tint,
            },
          ]}
        />
        <View style={[styles.repere, { left: `${position * 100}%`, backgroundColor: theme.text }]} />
      </View>

      <View style={styles.legende}>
        <ThemedText type="small" themeColor="textSecondary">
          {marketLabel}
        </ThemedText>
        <ThemedText
          type="smallBold"
          style={{ color: verdict === 'juste' ? Brand.teal : Brand.mango }}>
          {verdictLabels[verdict]}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    gap: Spacing.two,
  },
  piste: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  zoneJuste: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // Un lavis, pas un aplat : la piste reste lisible dessous, et la même
    // valeur tient sur fond clair comme sur fond sombre.
    opacity: 0.35,
  },
  repere: {
    position: 'absolute',
    top: -3,
    width: 3,
    height: 12,
    borderRadius: 2,
    // Le repère est posé PAR SON CENTRE : sans ce décalage, un prix au
    // minimum collerait son trait à droite du bord.
    marginLeft: -1.5,
  },
  legende: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
