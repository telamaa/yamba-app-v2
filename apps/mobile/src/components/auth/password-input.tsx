/**
 * password-input.tsx — le champ mot de passe avec œil (refonte sur captures).
 * ===========================================================================
 * Le champ bordé des pages auth du site : l'œil (SF Symbol, repli texte) à
 * droite, et la teinte lavande quand le champ est REMPLI — le repère visuel
 * des captures. 16 px minimum : sous ce seuil, iOS zoome au focus (A60).
 */
import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { SymbolView } from 'expo-symbols';
import { useTranslations } from 'use-intl';

import { Spacing } from '@/constants/theme';
import { AuthFieldHeight, AuthRadius, useAuthPalette } from '@/components/auth/auth-theme';

// La ref passe en PROP (React 19) : le chaînage clavier des écrans
// (`returnKeyType="next"` → focus du champ suivant) en a besoin.
type Props = Omit<TextInputProps, 'secureTextEntry'> & { ref?: Ref<TextInput> };

export function PasswordInput({ style, value, ...rest }: Props) {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  const [visible, setVisible] = useState(false);
  const filled = typeof value === 'string' && value.length > 0;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: filled ? palette.inputFilled : palette.card,
          borderColor: palette.border,
        },
      ]}>
      <TextInput
        style={[styles.input, { color: palette.title }, style]}
        placeholderTextColor={palette.muted}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        {...rest}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={Spacing.two}
        accessibilityRole="button"
        accessibilityLabel={visible ? t('common.hidePassword') : t('common.showPassword')}>
        <SymbolView
          name={visible ? 'eye.slash' : 'eye'}
          size={20}
          tintColor={palette.muted}
          fallback={
            <Text style={[styles.eyeFallback, { color: palette.muted }]}>
              {visible ? t('common.hide') : t('common.show')}
            </Text>
          }
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: AuthFieldHeight,
    borderWidth: 1,
    borderRadius: AuthRadius,
    paddingRight: Spacing.three,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  eyeFallback: {
    fontSize: 13,
    fontWeight: 600,
  },
});
