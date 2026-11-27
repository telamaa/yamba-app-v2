/**
 * photo-shelf.tsx — L'ÉTAGÈRE À PHOTOS, une fois pour toutes (D115).
 * ====================================================================
 * La prise de photo était recopiée dans TROIS écrans (`booking/content.tsx`,
 * `shipment/[id]/report.tsx`, `publish-trip/review.tsx`) : vignettes, voile
 * de téléversement, croix de retrait, ligne d'échec, chacun pour soi. La
 * prise en charge en aurait fait une quatrième et la remise une cinquième.
 * **On factorise au moment où l'on devient le quatrième, pas le deuxième.**
 *
 * Les trois copies existantes ne sont PAS migrées : entrer dans le tunnel de
 * réservation pour un motif cosmétique est un risque, pas une dette qu'on
 * paie. Une fiche les COMPTE — une dette comptée se rembourse, une dette
 * promise s'oublie.
 *
 * ── CE QU'IL AJOUTE AUX TROIS COPIES ────────────────────────────────────
 * Un RÉESSAI par photo. Les trois copies ne savent que RETIRER une photo en
 * échec : le Voyageur devait reprendre la photo du colis ouvert, debout,
 * devant l'Expéditeur. Le fichier est déjà sur l'appareil — on le renvoie.
 *
 * ── L'APPAREIL PHOTO AVANT LA PHOTOTHÈQUE ───────────────────────────────
 * Et les deux boutons sont VISIBLES, là où les trois copies posent une
 * `Alert` à trois branches (« Appareil photo / Photothèque / Annuler »). On
 * est devant le colis : la photo se prend, elle ne se cherche pas. Deux
 * boutons = un geste ; une alerte = deux gestes et une liste à lire.
 *
 * ── IL NE CONNAÎT AUCUN DICTIONNAIRE ────────────────────────────────────
 * Ses mots arrivent en `textes`. Le signalement dit « preuves », la prise en
 * charge dit « le colis ouvert » : un composant partagé qui choisirait les
 * mots imposerait le vocabulaire du PREMIER appelant (leçon D104 — « quand
 * un composant devient partagé, ses commentaires décrivent le premier
 * appelant »).
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { placesLibres, type PhotoLocale } from '@/lib/photos';
import type { SourcePhoto } from '@/hooks/use-photos';

export type TextesDeLEtagere = {
  /** « Prendre une photo » — l'appareil photo, en premier. */
  prendre: string;
  /** « Depuis la photothèque » */
  photothèque: string;
  retirer: string;
  reessayer: string;
  /** Le code d'échec, déjà traduit par l'appelant (`INVALID_TYPE`…). */
  echec: (code: string) => string;
};

export function PhotoShelf({
  photos,
  max,
  textes,
  onChoisirAction,
  onRetirerAction,
  onReessayerAction,
}: {
  photos: readonly PhotoLocale[];
  max: number;
  textes: TextesDeLEtagere;
  onChoisirAction: (source: SourcePhoto) => void;
  onRetirerAction: (id: string) => void;
  onReessayerAction: (id: string) => void;
}) {
  const theme = useTheme();
  const libres = placesLibres(photos, max);

  return (
    <View style={styles.bloc}>
      {photos.length > 0 ? (
        <View style={styles.rangee}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.boite}>
              <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" />

              {photo.uploading ? (
                <View style={styles.voile}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : null}

              {/* Une photo en échec se RÉESSAIE : tout le carré est la cible,
                  parce qu'un carré de 84 pt vaut mieux qu'une icône de 20. */}
              {photo.errorCode !== null ? (
                <Pressable
                  onPress={() => onReessayerAction(photo.id)}
                  accessibilityRole="button"
                  accessibilityLabel={textes.reessayer}
                  style={[styles.voile, styles.voileEchec]}>
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => onRetirerAction(photo.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={textes.retirer}
                style={styles.croix}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Le code d'échec est traduit par l'APPELANT : ImageKit répondrait en
          anglais, et son message n'est pas pour le membre. */}
      {photos
        .filter((photo) => photo.errorCode !== null)
        .map((photo) => (
          <ThemedText key={`${photo.id}-echec`} type="small" style={styles.echec}>
            {textes.echec(photo.errorCode as string)}
          </ThemedText>
        ))}

      {libres > 0 ? (
        <View style={styles.boutons}>
          <Bouton
            label={textes.prendre}
            icon="camera-outline"
            theme={theme}
            onPress={() => onChoisirAction('camera')}
          />
          <Bouton
            label={textes.photothèque}
            icon="images-outline"
            theme={theme}
            onPress={() => onChoisirAction('photothèque')}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Un bouton de source. Deux lignes de style, mais il est frappé deux fois. */
function Bouton({
  label,
  icon,
  theme,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.bouton,
        { borderColor: theme.backgroundSelected },
        pressed && styles.presse,
      ]}>
      <Ionicons name={icon} size={17} color={theme.text} />
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: Spacing.two },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  boite: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  voile: {
    // Les quatre côtés à la main : `StyleSheet.absoluteFillObject` n'existe
    // plus dans les typages de React Native 0.86.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  voileEchec: { backgroundColor: 'rgba(220,38,38,0.55)' },
  croix: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  echec: { color: '#DC2626' },
  boutons: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  bouton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    // 44 pt : la cible minimale d'un geste sur un téléphone.
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  presse: { opacity: 0.7 },
});
