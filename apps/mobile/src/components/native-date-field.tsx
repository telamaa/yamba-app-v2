/**
 * native-date-field.tsx — le sélecteur de date NATIF de chaque OS (lot
 * recherche-first). iOS : `DatePicker` SwiftUI en style `graphical` (le vrai
 * calendrier d'Apple) présenté dans une feuille ; Android : le
 * `DatePickerDialog` Material 3. Les deux viennent d'`@expo/ui`, déjà dans
 * les dépendances — zéro dépendance nouvelle. Les modules par plateforme
 * sont chargés PARESSEUSEMENT (`require` dans la branche) : importer le
 * paquet jetpack-compose sur iOS (et inversement) enregistrerait des vues
 * natives de l'autre OS.
 *
 * Le composant ne rend RIEN tant que `visible` est faux : le champ qui
 * l'ouvre appartient à l'écran appelant — lui ne fait que présenter le
 * calendrier et rapporter le jour choisi.
 */
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslations } from 'use-intl';

import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  /** Jour initial du calendrier (défaut : aujourd'hui). */
  initialDate: Date | null;
  onPickAction: (date: Date) => void;
  onDismissAction: () => void;
};

function IosSheet({ visible, initialDate, onPickAction, onDismissAction }: Props) {
  const t = useTranslations('search');
  const theme = useTheme();
  // Chargés à l'affichage seulement — jamais au chargement du module.
  const { Host, DatePicker } =
    require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
  const { datePickerStyle } =
    require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismissAction}>
      <Pressable style={styles.backdrop} onPress={onDismissAction}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.background }]}>
          <Host matchContents>
            <DatePicker
              selection={initialDate ?? new Date()}
              displayedComponents={['date']}
              range={{ start: new Date() }}
              onDateChange={onPickAction}
              modifiers={[datePickerStyle('graphical')]}
            />
          </Host>
          <Pressable onPress={onDismissAction} hitSlop={Spacing.two} style={styles.cancel}>
            <Text style={styles.cancelLabel}>{t('form.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AndroidDialog({ visible, initialDate, onPickAction, onDismissAction }: Props) {
  const t = useTranslations('search');
  if (!visible) return null;
  const { Host, DatePickerDialog } =
    require('@expo/ui/jetpack-compose') as typeof import('@expo/ui/jetpack-compose');

  return (
    <View style={styles.dialogAnchor} pointerEvents="box-none">
      <Host style={styles.dialogAnchor}>
        <DatePickerDialog
          initialDate={(initialDate ?? new Date()).toISOString()}
          variant="picker"
          showVariantToggle={false}
          color={Brand.mango}
          selectableDates={{ start: new Date() }}
          confirmButtonLabel={t('form.dateConfirm')}
          dismissButtonLabel={t('form.cancel')}
          onDateSelected={onPickAction}
          onDismissRequest={onDismissAction}
        />
      </Host>
    </View>
  );
}

export function NativeDateField(props: Props) {
  return Platform.OS === 'ios' ? <IosSheet {...props} /> : <AndroidDialog {...props} />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  sheet: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cancel: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
  cancelLabel: {
    color: Brand.mango,
    fontSize: 14,
    fontWeight: 600,
  },
  dialogAnchor: {
    position: 'absolute',
    width: 1,
    height: 1,
  },
});
