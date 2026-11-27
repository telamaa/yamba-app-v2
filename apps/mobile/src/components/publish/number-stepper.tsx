/**
 * number-stepper.tsx — régler un nombre au POUCE.
 * ================================================
 * Le site règle le prix au kilo et la capacité avec deux curseurs qui
 * GLISSENT : geste de souris, précis au pixel. Transposé tel quel sur un
 * téléphone, le curseur du prix offre 31 crans sur la largeur d'un écran,
 * soit ~12 px par cran — et surtout il fait EXPLORER un continuum à quelqu'un
 * qui a déjà son tarif en tête (« 10 € le kilo »).
 *
 * D'où le même arbitrage qu'A207 (calendrier) et D101 (poids du colis) :
 * mêmes nombres, geste natif. Deux boutons de 44 pt, la valeur au milieu,
 * et des valeurs d'usage dessous pour sauter là où l'on va de toute façon.
 *
 * Un bouton qui ne peut plus rien faire est ÉTEINT et le dit
 * (`accessibilityState.disabled`) — il ne disparaît pas : une cible qui
 * s'évapore déplace l'autre sous le pouce.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function NumberStepper({
  valeur,
  unite,
  peutMonter,
  peutDescendre,
  labelMoins,
  labelPlus,
  nomDeLaValeur,
  onStepAction,
}: {
  /** La valeur DÉJÀ mise en forme dans la langue du lecteur (D108). */
  valeur: string;
  unite: string;
  peutMonter: boolean;
  peutDescendre: boolean;
  labelMoins: string;
  labelPlus: string;
  /** Ce qu'annonce un lecteur d'écran à la place de « 10,00 » tout seul. */
  nomDeLaValeur: string;
  onStepAction: (sens: 1 | -1) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.rangee, { borderColor: theme.backgroundElement }]}>
      <Bouton
        icone="remove"
        actif={peutDescendre}
        label={labelMoins}
        onPressAction={() => onStepAction(-1)}
      />
      <View style={styles.valeurBloc} accessible accessibilityLabel={nomDeLaValeur}>
        <ThemedText type="title" style={styles.valeur}>
          {valeur}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {unite}
        </ThemedText>
      </View>
      <Bouton icone="add" actif={peutMonter} label={labelPlus} onPressAction={() => onStepAction(1)} />
    </View>
  );

  function Bouton({
    icone,
    actif,
    label,
    onPressAction,
  }: {
    icone: 'add' | 'remove';
    actif: boolean;
    label: string;
    onPressAction: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !actif }}
        disabled={!actif}
        onPress={onPressAction}
        style={({ pressed }) => [
          styles.bouton,
          { backgroundColor: theme.backgroundElement, opacity: actif ? (pressed ? 0.7 : 1) : 0.4 },
        ]}>
        <Ionicons name={icone} size={22} color={actif ? theme.text : theme.textSecondary} />
      </Pressable>
    );
  }
}

/** Les valeurs d'usage, sous le pas-à-pas : on saute là où l'on va souvent. */
export function ValeursUsuelles({
  valeurs,
  choisie,
  libelle,
  onPickAction,
}: {
  valeurs: readonly number[];
  choisie: number | null;
  libelle: (valeur: number) => string;
  onPickAction: (valeur: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {valeurs.map((valeur) => {
        const active = choisie !== null && Math.abs(choisie - valeur) < 0.001;
        return (
          <Pressable
            key={valeur}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onPickAction(valeur)}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: active ? Brand.mango : theme.backgroundElement,
                backgroundColor: active ? theme.backgroundElement : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <ThemedText type={active ? 'smallBold' : 'small'}>{libelle(valeur)}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  bouton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valeurBloc: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  valeur: {
    marginBottom: 0,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
});
