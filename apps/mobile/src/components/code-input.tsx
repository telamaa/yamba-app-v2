/**
 * code-input.tsx — LES SIX CASES, une seule fois pour toute l'app (D116 2A).
 * ===========================================================================
 * Le motif natif : UN `TextInput` invisible porte toute la valeur, six cases
 * l'AFFICHENT, et toucher les cases redonne le focus. Pas de gestion de
 * focus case par case comme les six `<input>` du web — c'est le champ unique
 * qui rend le collage natif gratuit.
 *
 * ── POURQUOI CETTE PRIMITIVE EXISTE ─────────────────────────────────────
 * `OtpInput` (lot auth) portait cette géométrie, mais soudée à deux choses
 * qui n'ont rien à voir avec elle : la palette « slate » des écrans d'auth,
 * et un nom accessible lu dans le dictionnaire `auth`. La remise avait donc
 * le choix entre importer l'ambiance d'un autre tunnel, ou recopier les
 * cases. **Deux géométries de cases à six chiffres seraient une incohérence
 * de charte — et une incohérence de charte ne se lit pas, elle se COMPTE
 * (D105).**
 *
 * D'où la forme, reprise de `BackButton` (D105) :
 *   • le nom accessible est EXIGÉ par la signature — on ne peut pas poser un
 *     champ muet (le défaut que D105 a trouvé sur deux en-têtes) ;
 *   • AUCUNE prop de taille, de couleur de case ou de rayon : une charte ne
 *     se défait pas par malveillance, elle se défait par une prop de trop ;
 *   • les couleurs arrivent en `palette`, parce que les deux appelants
 *     vivent dans deux ambiances assumées (slate pour l'auth, le thème de
 *     l'app ailleurs) — c'est une AMBIANCE, pas une géométrie.
 *
 * ── LE REMPLISSAGE AUTOMATIQUE EST UN CHOIX DE L'APPELANT ───────────────
 * Un code REÇU par SMS ou par mail mérite `oneTimeCode` / `sms-otp` : le
 * système le propose, c'est un geste économisé. Un code **DICTÉ** — celui de
 * la livraison, que le destinataire lit à voix haute (D43) — ne doit PAS les
 * porter : le téléphone proposerait un code reçu pour autre chose, devant
 * quelqu'un qui attend. D'où `autofill`, explicite, sans valeur par défaut
 * silencieuse.
 */
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';

/** Six chiffres : le code d'auth comme le code de livraison (D43). */
export const CODE_LENGTH = 6;

export type CodeInputPalette = {
  card: string;
  border: string;
  digit: string;
};

export function CodeInput({
  value,
  onChangeAction,
  accessibilityLabel,
  palette,
  autofill,
  autoFocus = false,
  disabled = false,
}: {
  value: string;
  onChangeAction: (digits: string) => void;
  /** EXIGÉ : un champ de saisie muet est un défaut d'accessibilité (D105). */
  accessibilityLabel: string;
  palette: CodeInputPalette;
  /** `true` pour un code REÇU (SMS, mail) ; `false` pour un code DICTÉ. */
  autofill: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<TextInput>(null);

  return (
    <Pressable onPress={() => input.current?.focus()} disabled={disabled}>
      <View style={styles.cells} pointerEvents="none">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const active = !disabled && value.length === i;
          return (
            <View
              key={i}
              style={[
                styles.cell,
                { backgroundColor: palette.card, borderColor: palette.border },
                active && styles.cellActive,
                disabled && styles.cellDisabled,
              ]}>
              <Text style={[styles.digit, { color: palette.digit }]}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        style={styles.hidden}
        value={value}
        // Les chiffres SEULEMENT, et jamais plus de six : un code collé avec
        // des espaces (« 742 891 ») entre quand même.
        onChangeText={(texte) => onChangeAction(texte.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        editable={!disabled}
        accessibilityLabel={accessibilityLabel}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType={autofill && Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
        autoComplete={autofill && Platform.OS === 'android' ? 'sms-otp' : undefined}
        maxLength={CODE_LENGTH}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cells: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  cell: {
    width: 48,
    height: 60,
    // 12 : exactement `AuthRadius`, la valeur des captures d'A208 — la
    // primitive REPREND la géométrie existante, elle ne la retouche pas.
    // Un refactor qui déplace un pixel n'est plus un refactor.
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  cellActive: {
    borderColor: Brand.mango,
  },
  cellDisabled: {
    opacity: 0.5,
  },
  digit: {
    fontSize: 24,
    // 600 : les chiffres restent nets sans devenir le centre de gravité de
    // l'écran. Ce qui les désigne est la case et le focus, pas la graisse.
    fontFamily: Font.semibold,
  },
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
