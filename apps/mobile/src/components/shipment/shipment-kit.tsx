/**
 * shipment-kit.tsx — la grammaire visuelle de la fiche de suivi.
 * ===============================================================
 * Même parti pris que la page trajet (refonte du 13/10) : une page À PLAT,
 * des sections séparées par un filet, et UNE SEULE carte sur tout l'écran.
 * Sur la fiche trajet, cette carte unique est le prix ; ici c'est le CODE DE
 * LIVRAISON — la seule chose qu'on sort du téléphone pour la montrer à
 * quelqu'un. Tout empiler dans des boîtes grises donnerait le même poids à
 * tout, donc du poids à rien.
 *
 * Les primitives vivent ici parce que trois écrans vont les partager (la
 * fiche, puis le signalement et la notation) : les dupliquer ferait diverger
 * les filets et les marges au premier correctif.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/* ── Chrome ──────────────────────────────────────────────────────────────── */

/** Le bandeau du haut : un retour, et rien d'autre. Le titre est dans la page
 *  (il se lit en grand une fois, pas en petit en permanence).
 *
 *  Le retour n'est pas toujours un `back` : la fiche s'ouvre aussi en
 *  REMPLACEMENT depuis la fin du tunnel de réservation (le parcours a été
 *  dépilé pour qu'on ne retombe jamais sur une carte déjà autorisée). Sans
 *  pile derrière, `back` ne mène nulle part — on rejoint alors l'activité. */
export function ShipmentTopBar({ onRefreshAction }: { onRefreshAction?: () => void }) {
  const t = useTranslations('shipment');
  const theme = useTheme();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/activity');
  };

  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={goBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('back')}
        style={({ pressed }) => [
          styles.iconButton,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="chevron-back" size={22} color={theme.text} />
      </Pressable>
      {onRefreshAction ? (
        <Pressable
          onPress={onRefreshAction}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('refresh')}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="refresh" size={19} color={theme.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Sections et lignes ──────────────────────────────────────────────────── */

/** Une section = un filet en haut et de l'air. Aucune boîte. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: theme.backgroundElement }]}>
      {title ? (
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          {title}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

/** Un libellé discret à gauche, une valeur alignée à droite. */
export function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
        {label}
      </ThemedText>
      {children ?? (
        <ThemedText type="smallBold" style={styles.rowValue}>
          {value ?? '—'}
        </ThemedText>
      )}
    </View>
  );
}

/** Une sur-ligne en capitales : elle TITRE un bloc sans lui donner le poids
 *  d'un titre de section. */
export function Overline({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
      {children}
    </ThemedText>
  );
}

/** Une liste numérotée — « ce qui arrive ensuite » et rien d'autre. */
export function Steps({ items }: { items: string[] }) {
  return (
    <View style={styles.steps}>
      {items.map((item, index) => (
        <View key={index} style={styles.step}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {index + 1}.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Un encart d'information, posé sur le fond d'élément du thème. */
export function Notice({
  icon = 'information-circle-outline',
  children,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {children}
      </ThemedText>
    </View>
  );
}

/* ── Boutons ─────────────────────────────────────────────────────────────── */

/**
 * Un geste. Trois tons : `primary` (mangue, l'action attendue), `neutral`
 * (bordé, une action ordinaire) et `quiet` (texte seul, une sortie).
 *
 * Pas de bouton DÉSACTIVÉ : si le serveur n'autorise pas le geste, l'appelant
 * ne rend pas le bouton (A209). `pending` n'est pas une désactivation, c'est
 * le même bouton qui travaille.
 */
export function Action({
  label,
  tone = 'neutral',
  icon,
  pending = false,
  onPressAction,
}: {
  label: string;
  tone?: 'primary' | 'neutral' | 'quiet';
  icon?: keyof typeof Ionicons.glyphMap;
  pending?: boolean;
  onPressAction: () => void;
}) {
  const theme = useTheme();

  const background =
    tone === 'primary' ? Brand.mango : tone === 'neutral' ? 'transparent' : 'transparent';
  const color = tone === 'primary' ? '#FFFFFF' : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: pending }}
      onPress={pending ? undefined : onPressAction}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: background },
        tone === 'neutral' && { borderWidth: 1, borderColor: theme.backgroundSelected },
        tone === 'quiet' && styles.actionQuiet,
        pressed && styles.pressed,
      ]}>
      {pending ? (
        <ActivityIndicator size="small" color={color} />
      ) : icon ? (
        <Ionicons name={icon} size={17} color={color} />
      ) : null}
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/* ── Confirmation ────────────────────────────────────────────────────────── */

/**
 * La feuille de confirmation des gestes qui engagent (annuler, régénérer,
 * confirmer la réception). Une feuille et non une `Alert` native : il y a
 * des MONTANTS et des conséquences à lire, et une alerte système ne sait
 * afficher ni l'un ni l'autre proprement sur les deux OS.
 *
 * Le bouton qui CONFIRME n'est jamais le plus visible quand le geste est
 * définitif : c'est « garder » qui porte le ton plein.
 */
export function ConfirmSheet({
  visible,
  title,
  lines,
  confirmLabel,
  keepLabel,
  pendingLabel,
  pending,
  error,
  destructive = false,
  onConfirmAction,
  onCancelAction,
}: {
  visible: boolean;
  title: string;
  lines: string[];
  confirmLabel: string;
  keepLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  destructive?: boolean;
  onConfirmAction: () => void;
  onCancelAction: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      // Le bouton retour d'Android doit fermer la feuille, jamais l'écran.
      onRequestClose={pending ? undefined : onCancelAction}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropFill}
          accessibilityRole="button"
          accessibilityLabel={keepLabel}
          onPress={pending ? undefined : onCancelAction}
        />
        <ThemedView
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={[styles.sheetGrip, { backgroundColor: theme.backgroundSelected }]} />
          <ThemedText type="subtitle">{title}</ThemedText>
          {lines.map((line, index) => (
            <ThemedText key={index} type="small" themeColor="textSecondary">
              {line}
            </ThemedText>
          ))}
          {error ? (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
          <View style={styles.sheetActions}>
            <Action
              label={pending ? pendingLabel : confirmLabel}
              tone={destructive ? 'neutral' : 'primary'}
              pending={pending}
              onPressAction={onConfirmAction}
            />
            {pending ? null : (
              <Action
                label={keepLabel}
                tone={destructive ? 'primary' : 'quiet'}
                onPressAction={onCancelAction}
              />
            )}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  flex: { flex: 1, minWidth: 0 },

  section: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 15, lineHeight: 22 },
  overline: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  rowLabel: { flex: 1, minWidth: 0 },
  rowValue: { flexShrink: 1, textAlign: 'right' },

  steps: { gap: Spacing.two },
  step: { flexDirection: 'row', gap: Spacing.two },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: 12,
    padding: Spacing.three,
  },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  actionQuiet: { minHeight: 44, paddingVertical: Spacing.two },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdropFill: { flex: 1 },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  sheetGrip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  sheetActions: { gap: Spacing.two, paddingTop: Spacing.two },
  error: { color: '#DC2626' },
});
