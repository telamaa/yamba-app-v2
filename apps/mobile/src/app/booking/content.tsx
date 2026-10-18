/**
 * booking/content.tsx — LA DESCRIPTION ET LES PHOTOS (étape ③, A217).
 * ====================================================================
 * Ce que contient le colis, en mots puis en images. Vient APRÈS la protection
 * (A214/A217) : c'est la Garantie qui rend la photo obligatoire, et on ne peut
 * pas exiger une preuve pour une couverture qui n'a pas encore été demandée.
 *
 * Les photos restent LOCALES à cette étape : on garde l'URI de l'appareil, le
 * téléversement a lieu à la création de la réservation. Un brouillon qu'on
 * abandonne ne doit pas avoir déjà envoyé des images sur nos serveurs.
 *
 * `expo-image-picker` demande la permission à l'USAGE, jamais à l'ouverture de
 * l'écran : une demande d'accès à la photothèque sans geste de l'utilisateur
 * est la façon la plus sûre de se la faire refuser définitivement.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BookingStepFrame } from '@/components/booking/booking-step-frame';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentPricingParams, loadPricingParams } from '@/lib/api/pricing.api';
import { getPublicTrip, type PublicTrip } from '@/lib/api/trip.api';
import { setBookingDraft, useBookingDraft } from '@/lib/booking-draft';
import { quoteDraft, validateContentStep } from '@/lib/booking-rules';
import { formatPrice } from '@/lib/trip-format';

/** Le même plafond que le site (MAX_PHOTOS) : une photo du contenu, une de l'emballage, et de la marge. */
const MAX_PHOTOS = 5;

/** Les mêmes quatre règles que le site : emballer, peser, décrire, rien d'interdit. */
const GOLDEN_RULES_KEYS = ['pack', 'weigh', 'describe', 'prohibited'] as const;

export default function BookingContentScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const t = useTranslations('booking');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const draft = useBookingDraft();

  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [failed, setFailed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [params, setParams] = useState(currentPricingParams);

  useEffect(() => {
    let alive = true;
    if (!tripId) {
      setFailed(true);
      return;
    }
    void getPublicTrip(tripId)
      .then((loaded) => {
        if (alive) setTrip(loaded);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    void loadPricingParams().then((p) => {
      if (alive) setParams(() => p);
    });
    return () => {
      alive = false;
    };
  }, [tripId]);

  const errors = useMemo(() => validateContentStep(draft), [draft]);

  /**
   * Deux chemins, et le premier compte : sur un téléphone, photographier le
   * colis qu'on a sous la main est le geste NATUREL. N'offrir que la
   * photothèque obligeait à sortir de l'app, prendre la photo, revenir.
   *
   * La permission se demande AU GESTE, jamais au montage de l'écran, et
   * séparément pour chaque source : accepter l'appareil photo ne doit pas
   * donner accès à toute la photothèque.
   */
  const pickFrom = useCallback(
    async (source: 'camera' | 'library') => {
      if (draft.photos.length >= MAX_PHOTOS) return;
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t(source === 'camera' ? 'content.cameraDeniedTitle' : 'content.permissionTitle'),
          t(source === 'camera' ? 'content.cameraDeniedBody' : 'content.permissionBody')
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              selectionLimit: MAX_PHOTOS - draft.photos.length,
              allowsMultipleSelection: true,
            });
      if (result.canceled) return;
    // Le CONTEXTE se déduit du rang, comme le dit l'aide juste en dessous : la
    // première photo montre le contenu déballé, la deuxième le colis emballé.
    // Les suivantes sont libres. L'URI locale sert d'identifiant — elle est
    // unique sur l'appareil, et la photo n'a pas encore d'identité serveur.
      const added = result.assets.map((asset, i) => {
        const rank = draft.photos.length + i;
        return {
          id: asset.assetId ?? asset.uri,
          uri: asset.uri,
          context:
            rank === 0
              ? ('DECLARED_CONTENT' as const)
              : rank === 1
                ? ('DECLARED_PACKAGED' as const)
                : ('CUSTOM' as const),
        };
      });
      setBookingDraft({ photos: [...draft.photos, ...added].slice(0, MAX_PHOTOS) });
    },
    [draft.photos, t]
  );

  /** Le choix de la source. `Alert` plutôt qu'une feuille maison : c'est le
   *  sélecteur natif des deux OS, donc familier et gratuit en accessibilité. */
  const addPhoto = useCallback(() => {
    Alert.alert(t('content.addPhoto'), undefined, [
      { text: t('content.fromCamera'), onPress: () => void pickFrom('camera') },
      { text: t('content.fromLibrary'), onPress: () => void pickFrom('library') },
      { text: t('content.cancel'), style: 'cancel' },
    ]);
  }, [pickFrom, t]);

  const removePhoto = useCallback(
    (id: string) => setBookingDraft({ photos: draft.photos.filter((p) => p.id !== id) }),
    [draft.photos]
  );

  const onContinue = useCallback(() => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    router.push({ pathname: '/booking/places', params: { tripId: trip?.id ?? '' } });
  }, [errors, trip?.id]);

  if (failed) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">{t('unavailable.title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          {t('unavailable.body')}
        </ThemedText>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <ThemedText type="smallBold">{t('unavailable.cta')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (!trip) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={Brand.mango} />
      </ThemedView>
    );
  }

  const quote = quoteDraft(draft, trip, params);
  const guaranteed = draft.protection === 'EXTENDED_500';

  return (
    <BookingStepFrame
      title={t('content.title')}
      subtitle={t('content.subtitle')}
      step={3}
      priceLabel={
        quote.ok === true ? formatPrice(quote.quote.totalShipperCents, trip.currencyCode, locale) : null
      }
      priceHint={quote.ok === true ? t('bar.allIn') : t('bar.quoteError.GENERIC')}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        <View style={styles.field}>
          <ThemedText type="smallBold">{t('content.descriptionLabel')}</ThemedText>
          <TextInput
            value={draft.description}
            onChangeText={(description) => setBookingDraft({ description })}
            placeholder={t('content.descriptionPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={3}
            maxLength={280}
            accessibilityLabel={t('content.descriptionLabel')}
            style={[styles.textarea, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('content.descriptionHint')}
          </ThemedText>
          {showErrors && errors.description ? <FieldError code={errors.description} /> : null}
        </View>

        <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />

        <View style={styles.field}>
          <ThemedText type="smallBold">
            {t('content.photosLabel')}
            {guaranteed ? (
              <ThemedText type="small" style={{ color: Brand.mango }}>
                {' '}
                {t('content.photosRequired')}
              </ThemedText>
            ) : null}
          </ThemedText>

          <View style={styles.photoGrid}>
            {draft.photos.map((photo) => (
              <View key={photo.id} style={styles.thumb}>
                <Image source={{ uri: photo.uri }} style={styles.thumbImage} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('content.removePhoto')}
                  onPress={() => removePhoto(photo.id)}
                  hitSlop={8}
                  style={styles.thumbRemove}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {draft.photos.length < MAX_PHOTOS ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('content.addPhoto')}
                onPress={addPhoto}
                style={[styles.thumb, styles.thumbAdd, { borderColor: theme.textSecondary }]}>
                <Ionicons name="add" size={22} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {t('content.photosHint', { max: MAX_PHOTOS })}
          </ThemedText>
          {showErrors && errors.photos ? <FieldError code={errors.photos} /> : null}
        </View>
      </View>

      {/* LES RÈGLES D'OR — repliées, comme sur le site : elles n'exigent aucune
          action, elles ne doivent donc pas peser autant que les champs. Elles
          vivent ICI et non à l'étape ① parce qu'elles parlent de ce qu'on vient
          de décrire : emballer, peser, décrire fidèlement. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: rulesOpen }}
        onPress={() => setRulesOpen((v) => !v)}
        style={styles.rulesToggle}>
        <Ionicons name="bulb-outline" size={16} color={Brand.teal} />
        <ThemedText type="small" style={styles.rulesTitle}>
          {t('content.goldenRules.title')}
        </ThemedText>
        <Ionicons
          name={rulesOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
      {rulesOpen ? (
        <View style={styles.rulesList}>
          {GOLDEN_RULES_KEYS.map((key) => (
            <View key={key} style={styles.ruleItem}>
              <ThemedText type="small" themeColor="textSecondary">
                •
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.ruleText}>
                {t(`content.goldenRules.${key}`, { name: trip.tripper.firstName })}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </BookingStepFrame>
  );

  function FieldError({ code }: { code: string }) {
    return (
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
        <ThemedText type="small" style={{ color: Brand.mango }}>
          {t(`content.errors.${code}`)}
        </ThemedText>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  centeredText: { textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: Spacing.four },
  field: { paddingVertical: Spacing.four, gap: Spacing.two },
  hairline: { height: StyleSheet.hairlineWidth },
  textarea: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    minHeight: 88,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumb: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  thumbAdd: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  rulesToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  rulesTitle: { flex: 1 },
  rulesList: { gap: Spacing.one, paddingLeft: Spacing.five },
  ruleItem: { flexDirection: 'row', gap: Spacing.two },
  ruleText: { flex: 1 },
});
