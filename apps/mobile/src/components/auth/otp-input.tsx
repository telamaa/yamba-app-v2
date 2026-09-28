/**
 * otp-input.tsx — la saisie du code à 6 chiffres (lot auth mobile).
 * =================================================================
 * Le motif natif : UN `TextInput` invisible porte toute la valeur (clavier
 * numérique, collage d'un code entier, remplissage automatique iOS
 * `oneTimeCode` / Android `sms-otp`), six cases l'AFFICHENT — toucher les
 * cases redonne le focus. Pas de gestion de focus case par case comme les
 * six `<input>` du web : c'est le champ unique qui rend le collage et
 * l'autofill natifs gratuits.
 */
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const OTP_LENGTH = 6;

type Props = {
  value: string;
  onChangeAction: (digits: string) => void;
  disabled?: boolean;
};

export function OtpInput({ value, onChangeAction, disabled = false }: Props) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);

  const onChange = (text: string) => {
    onChangeAction(text.replace(/\D/g, '').slice(0, OTP_LENGTH));
  };

  return (
    <Pressable onPress={() => input.current?.focus()} disabled={disabled}>
      <View style={styles.cells} pointerEvents="none">
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const active = !disabled && value.length === i;
          return (
            <View
              key={i}
              style={[
                styles.cell,
                { backgroundColor: theme.backgroundElement },
                active && styles.cellActive,
                disabled && styles.cellDisabled,
              ]}>
              <ThemedText type="subtitle">{value[i] ?? ''}</ThemedText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        style={styles.hidden}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        autoFocus
        keyboardType="number-pad"
        textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : undefined}
        maxLength={OTP_LENGTH}
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
    width: 44,
    height: 52,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellActive: {
    borderColor: Brand.mango,
  },
  cellDisabled: {
    opacity: 0.5,
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
