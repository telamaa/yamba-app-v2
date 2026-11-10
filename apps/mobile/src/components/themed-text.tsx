import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? (type === 'linkPrimary' ? 'tint' : 'text')] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Échelle resserrée (lot bienvenue, revue sur captures) : l'ancienne
// (title 48, subtitle 32) criait sur un écran de téléphone — la référence
// tient ses gros titres vers 24-30 pt. Le gras compense la taille.
const styles = StyleSheet.create({
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Font.medium,
  },
  smallBold: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Font.bold,
  },
  default: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Font.medium,
  },
  title: {
    fontSize: 30,
    fontFamily: Font.extrabold,
    lineHeight: 41,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: Font.bold,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    // Le SEUL `fontWeight` qui subsiste dans `src/`, et il est légitime : il
    // porte sur la famille MONO, pas sur Plus Jakarta. Le gras de synthèse
    // qu'on redoute ailleurs (D95) est justement ce qu'on cherche ici — la
    // mono d'Android est trop maigre d'un cran.
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
