/**
 * password-input.tsx — le champ mot de passe avec œil (lot auth mobile).
 * ======================================================================
 * Un `TextInput` sécurisé + la bascule afficher/masquer (l'œil du web, en
 * texte — pas d'icône embarquée pour deux états). 16 px minimum : sous ce
 * seuil, iOS zoome la page au focus (leçon A60).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<TextInputProps, 'secureTextEntry'>;

export function PasswordInput({ style, ...rest }: Props) {
  const t = useTranslations('auth');
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <TextInput
        style={[styles.input, { color: theme.text }, style]}
        placeholderTextColor={theme.textSecondary}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={Spacing.two}
        accessibilityRole="button"
        accessibilityLabel={visible ? t('common.hidePassword') : t('common.showPassword')}>
        <ThemedText type="small" themeColor="textSecondary">
          {visible ? t('common.hide') : t('common.show')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingRight: Spacing.three,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
});
