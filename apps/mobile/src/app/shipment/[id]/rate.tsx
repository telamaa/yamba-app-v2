/**
 * shipment/[id]/rate.tsx — « Noter le Voyageur », côté Expéditeur.
 * ================================================================
 * La notation mutuelle (B5, D53), en natif. Un envoi terminé se note une
 * fois, dans les quatorze jours, et la note reste INVISIBLE jusqu'à ce que
 * l'autre ait noté aussi — ou jusqu'à la fin de la fenêtre. C'est le
 * double-aveugle : il empêche la note de représailles, et il explique pourquoi
 * cet écran a quatre visages là où le tunnel n'en a qu'un.
 *
 * Le jumeau web est `apps/user-ui/src/components/rating/` (onze composants,
 * deux arbres). Les textes « courts » du site sont la bonne longueur ici, et
 * la même décision 2A tient : on ne montre NI la note moyenne NI le nombre
 * de deals de la personne notée — un ancrage fausserait l'avis.
 *
 * Le serveur décide de tout (RG-MOB-1) : `canRate` est SON verdict, la
 * fenêtre et la révélation sont SES dates, et la note de l'autre n'arrive
 * dans le contrat qu'une fois révélée (`counterpartRating` reste `null`
 * avant). L'app n'a donc rien à cacher elle-même — une vérité qu'un client
 * doit protéger est déjà fuitée.
 *
 * Ce que cet écran NE fait pas : noter côté Voyageur. L'app n'a pas encore
 * son mode Voyageur ; un deal dont le compte connecté est le Voyageur le dit
 * et s'arrête là, plutôt que d'afficher des critères sans textes (A203).
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import {
  Action,
  Notice,
  Overline,
  Section,
  ShipmentTopBar,
} from '@/components/shipment/shipment-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import {
  getRatingContext,
  submitRating,
  WrongRatingSideError,
  type RatingContext,
  type RatingReview,
} from '@/lib/api/rating.api';
import {
  canSubmitRating,
  CARRIER_CRITERIA,
  describeComment,
  EMPTY_RATING_FORM,
  RATING_COMMENT_MAX_LENGTH,
  ratingFace,
  ratingFailureKey,
  toggleCriterion,
  toRatingPayload,
  type RatingCriterion,
  type RatingForm,
} from '@/lib/rating-form';
import { shipmentReference } from '@/lib/shipment-view';
import { formatLongDate, getInitials } from '@/lib/trip-format';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'wrongRole' }
  | { kind: 'error'; correlationId: string | null }
  | { kind: 'loaded'; context: RatingContext };

export default function ShipmentRateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('shipment');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [form, setForm] = useState<RatingForm>(EMPTY_RATING_FORM);
  const [showRequired, setShowRequired] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Non nul dès que la note est partie : l'écran raconte alors ce qui
   *  vient de se passer, y compris la révélation immédiate. */
  const [published, setPublished] = useState<{ revealed: boolean } | null>(null);

  useEffect(() => {
    if (!id) {
      setState({ kind: 'notFound' });
      return;
    }
    let alive = true;
    getRatingContext(id)
      .then((context) => {
        if (alive) setState({ kind: 'loaded', context });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof WrongRatingSideError) setState({ kind: 'wrongRole' });
        else if (e instanceof ApiError && (e.status === 404 || e.status === 403))
          setState({ kind: 'notFound' });
        else if (e instanceof ApiError) setState({ kind: 'error', correlationId: e.correlationId });
        else setState({ kind: 'error', correlationId: null });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const backToShipment = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/shipment/[id]', params: { id: id ?? '' } });
  }, [id]);

  const publish = useCallback(async () => {
    if (state.kind !== 'loaded' || publishing) return;
    if (!canSubmitRating(form)) {
      setShowRequired(true);
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const result = await submitRating(state.context.bookingId, toRatingPayload(form));
      setPublished({ revealed: result.revealed });
    } catch (e: unknown) {
      const key = ratingFailureKey(
        e instanceof ApiError ? e.code : null,
        e instanceof ApiError ? e.status : 0
      );
      setError(t(`rating.errors.${key}`));
      if (key === 'conflict') {
        // « Déjà noté » ou « fenêtre fermée » : le formulaire n'a plus
        // d'objet. On RELIT le contexte plutôt que d'afficher un message
        // sous un formulaire mort — l'écran bascule alors de lui-même sur
        // le visage que le serveur décrit (note envoyée, ou fermée).
        void getRatingContext(state.context.bookingId)
          .then((fresh) => setState({ kind: 'loaded', context: fresh }))
          // Une relecture qui échoue laisse l'écran tel quel, avec son
          // message : on ne remplace pas un refus lisible par une panne.
          .catch(() => undefined);
      }
    } finally {
      setPublishing(false);
    }
  }, [state, form, publishing, t]);

  /* ── Les états sans formulaire ────────────────────────────────────────── */

  if (state.kind !== 'loaded') {
    return (
      <Frame>
        {state.kind === 'loading' ? (
          <View style={styles.centeredBlock}>
            <ActivityIndicator color={Brand.mango} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('loading')}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.centeredBlock}>
            <ThemedText type="subtitle">
              {t(
                state.kind === 'wrongRole'
                  ? 'rating.wrongRole.title'
                  : state.kind === 'notFound'
                    ? 'rating.unavailable.title'
                    : 'error.title'
              )}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {t(
                state.kind === 'wrongRole'
                  ? 'rating.wrongRole.body'
                  : state.kind === 'notFound'
                    ? 'rating.errors.notFound'
                    : 'error.body'
              )}
            </ThemedText>
            {state.kind === 'error' && state.correlationId ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                {t('error.reference', { id: state.correlationId })}
              </ThemedText>
            ) : null}
            <Action label={t('rating.success.back')} tone="primary" onPressAction={backToShipment} />
          </View>
        )}
      </Frame>
    );
  }

  const context = state.context;
  const carrierFirstName = context.person.firstName.trim() || t('carrier.title');
  const windowDate = formatLongDate(context.windowEndsAt, locale);

  /* ── La note vient d'être publiée ─────────────────────────────────────── */

  if (published !== null) {
    return (
      <Frame>
        <View style={styles.centeredBlock}>
          <Ionicons name="checkmark-done-circle-outline" size={44} color={Brand.teal} />
          <ThemedText type="subtitle">{t('rating.success.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {published.revealed
              ? t('rating.success.bothRated', { carrierFirstName })
              : windowDate
                ? t('rating.success.body', { carrierFirstName, date: windowDate })
                : t('rating.success.bodyNoDate', { carrierFirstName })}
          </ThemedText>
          <Action label={t('rating.success.back')} tone="primary" onPressAction={backToShipment} />
        </View>
      </Frame>
    );
  }

  const face = ratingFace(
    {
      canRate: context.canRate,
      ratedByMe: context.myRating !== null,
      revealedAt: context.revealedAt,
      windowEndsAt: context.windowEndsAt,
    },
    Date.now()
  );

  /* ── Déjà noté, révélé, fermé : on lit, on ne saisit plus ─────────────── */

  if (face !== 'form') {
    return (
      <Frame>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + Spacing.five }]}>
          <ShipmentTopBar />
          <ThemedText type="title">
            {t(
              face === 'revealed'
                ? 'rating.state.revealedTitle'
                : face === 'sent'
                  ? 'rating.state.sentTitle'
                  : face === 'closed'
                    ? 'rating.state.closedTitle'
                    : 'rating.unavailable.title'
            )}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {face === 'revealed'
              ? t('rating.state.revealedBody')
              : face === 'sent'
                ? windowDate
                  ? t('rating.state.sentBody', { carrierFirstName, date: windowDate })
                  : t('rating.state.sentBodyNoDate', { carrierFirstName })
                : face === 'closed'
                  ? t('rating.state.closedBody')
                  : t('rating.unavailable.body')}
          </ThemedText>

          {context.myRating ? (
            <Section title={t('rating.review.mine', { carrierFirstName })}>
              <ReviewBlock review={context.myRating} locale={locale} />
            </Section>
          ) : null}

          {/* La note de l'autre n'existe dans le contrat qu'une fois
              révélée : son absence ici est le double-aveugle, pas un trou. */}
          {face === 'revealed' ? (
            <Section title={t('rating.review.theirs', { carrierFirstName })}>
              {context.counterpartRating ? (
                <ReviewBlock review={context.counterpartRating} locale={locale} />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('rating.review.theirsMissing', { carrierFirstName })}
                </ThemedText>
              )}
            </Section>
          ) : null}

          <Section>
            <Action label={t('rating.success.back')} tone="primary" onPressAction={backToShipment} />
          </Section>
        </ScrollView>
      </Frame>
    );
  }

  /* ── Le formulaire ───────────────────────────────────────────────────── */

  const comment = describeComment(form.comment);

  return (
    <Frame>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.page, { paddingBottom: Spacing.five }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <ShipmentTopBar />

          <ThemedText type="title">{t('rating.title', { carrierFirstName })}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('rating.subtitle', {
              reference: shipmentReference(context.bookingId),
              route: t('route', {
                origin: context.corridor.originCity,
                destination: context.corridor.destinationCity,
              }),
            })}
          </ThemedText>

          {/* La personne notée : qui, et le trajet. Ni moyenne ni nombre de
              deals (décision 2A) — un ancrage fausserait l'avis. */}
          <View style={styles.personRow}>
            {context.person.avatarUrl ? (
              <Image
                source={{ uri: context.person.avatarUrl }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">
                  {getInitials(context.person.firstName, context.person.lastInitial)}
                </ThemedText>
              </View>
            )}
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                {`${context.person.firstName} ${context.person.lastInitial}`.trim()}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('carrier.title')}
              </ThemedText>
            </View>
          </View>

          <View style={styles.intro}>
            <Notice icon="eye-off-outline">{t('rating.intro', { carrierFirstName })}</Notice>
          </View>

          {/* ── La note globale : le seul champ requis ─────────────────── */}
          <Section title={t('rating.stars.label')}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setForm((f) => ({ ...f, rating: value }))}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.rating === value }}
                  accessibilityLabel={t(`rating.stars.value${value}`)}
                  style={({ pressed }) => [styles.star, pressed && styles.pressed]}>
                  <Ionicons
                    name={form.rating >= value ? 'star' : 'star-outline'}
                    size={34}
                    color={form.rating >= value ? Brand.mango : theme.backgroundSelected}
                  />
                </Pressable>
              ))}
            </View>
            {form.rating > 0 ? (
              <ThemedText type="smallBold">{t(`rating.stars.value${form.rating}`)}</ThemedText>
            ) : showRequired ? (
              <ThemedText type="small" style={styles.required}>
                {t('rating.stars.required')}
              </ThemedText>
            ) : null}
          </Section>

          {/* ── Les critères, facultatifs ──────────────────────────────── */}
          <Section title={t('rating.criteria.title')}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('rating.criteria.hint')}
            </ThemedText>
            {CARRIER_CRITERIA.map((criterion) => (
              <View key={criterion} style={styles.criterion}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{t(`rating.criteria.${criterion}.name`)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(`rating.criteria.${criterion}.desc`)}
                  </ThemedText>
                </View>
                <View style={styles.thumbs}>
                  <Thumb
                    vote="UP"
                    selected={form.criteria[criterion] === 'UP'}
                    label={t('rating.criteria.up')}
                    onPressAction={() =>
                      setForm((f) => ({ ...f, criteria: toggleCriterion(f.criteria, criterion, 'UP') }))
                    }
                  />
                  <Thumb
                    vote="DOWN"
                    selected={form.criteria[criterion] === 'DOWN'}
                    label={t('rating.criteria.down')}
                    onPressAction={() =>
                      setForm((f) => ({
                        ...f,
                        criteria: toggleCriterion(f.criteria, criterion, 'DOWN'),
                      }))
                    }
                  />
                </View>
              </View>
            ))}
          </Section>

          {/* ── Le commentaire, facultatif ─────────────────────────────── */}
          <Section title={t('rating.comment.title')}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('rating.comment.hint', { max: RATING_COMMENT_MAX_LENGTH })}
            </ThemedText>
            <TextInput
              value={form.comment}
              onChangeText={(value) => setForm((f) => ({ ...f, comment: value }))}
              multiline
              maxLength={RATING_COMMENT_MAX_LENGTH}
              textAlignVertical="top"
              placeholder={t('rating.comment.placeholder', { carrierFirstName })}
              placeholderTextColor={theme.textSecondary}
              style={[styles.textArea, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              accessibilityLabel={t('rating.comment.title')}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={comment.nearLimit ? styles.required : undefined}>
              {t('rating.comment.counter', { count: comment.length, max: comment.max })}
            </ThemedText>
          </Section>

          <Section>
            <ThemedText type="small" themeColor="textSecondary">
              {t('rating.visibility', { carrierFirstName })}
            </ThemedText>
            {windowDate ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('rating.prompt.deadline', { date: windowDate })}
              </ThemedText>
            ) : null}
          </Section>
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            { borderTopColor: theme.backgroundElement, paddingBottom: insets.bottom + Spacing.two },
          ]}>
          {error ? (
            <ThemedText type="small" style={styles.required}>
              {error}
            </ThemedText>
          ) : null}
          <Action
            label={publishing ? t('rating.publish.pending') : t('rating.publish.label')}
            tone="primary"
            icon="send-outline"
            pending={publishing}
            onPressAction={() => void publish()}
          />
        </View>
      </KeyboardAvoidingView>
    </Frame>
  );
}

/* ══ Blocs ═══════════════════════════════════════════════════════════════ */

/** Le cadre commun aux cinq visages : le fond du thème et la zone sûre. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        {children}
      </SafeAreaView>
    </ThemedView>
  );
}

/** Un pouce. Posé une seconde fois, il s'efface (`toggleCriterion`). */
function Thumb({
  vote,
  selected,
  label,
  onPressAction,
}: {
  vote: 'UP' | 'DOWN';
  selected: boolean;
  label: string;
  onPressAction: () => void;
}) {
  const theme = useTheme();
  const tint = vote === 'UP' ? Brand.teal : '#DC2626';

  return (
    <Pressable
      onPress={onPressAction}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.thumb,
        {
          borderColor: selected ? tint : theme.backgroundSelected,
          backgroundColor: selected ? `${tint}1A` : 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <Ionicons
        name={vote === 'UP' ? 'thumbs-up-outline' : 'thumbs-down-outline'}
        size={18}
        color={selected ? tint : theme.textSecondary}
      />
    </Pressable>
  );
}

/** Une note publiée : les étoiles, les pouces gardés, le mot, la date. */
function ReviewBlock({ review, locale }: { review: RatingReview; locale: SupportedLocale }) {
  const t = useTranslations('shipment');
  const theme = useTheme();
  const criteria = Object.entries(review.criteria ?? {}) as [RatingCriterion, 'UP' | 'DOWN'][];

  return (
    <View style={styles.reviewBlock}>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Ionicons
            key={value}
            name={review.rating >= value ? 'star' : 'star-outline'}
            size={18}
            color={review.rating >= value ? Brand.mango : theme.backgroundSelected}
          />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          {t('rating.review.scale', { rating: review.rating })}
        </ThemedText>
      </View>
      {criteria.length > 0 ? (
        <View style={styles.reviewCriteria}>
          {criteria.map(([criterion, vote]) => (
            <View key={criterion} style={styles.reviewCriterion}>
              <Ionicons
                name={vote === 'UP' ? 'thumbs-up' : 'thumbs-down'}
                size={13}
                color={vote === 'UP' ? Brand.teal : '#DC2626'}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {t(`rating.criteria.${criterion}.name`)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText type="small">
        {review.comment?.trim() ? review.comment : t('rating.review.noComment')}
      </ThemedText>
      <Overline>{t('rating.review.on', { date: formatLongDate(review.submittedAt, locale) })}</Overline>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  page: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  centeredBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  centeredText: { textAlign: 'center' },
  pressed: { opacity: 0.6 },
  intro: { paddingTop: Spacing.three },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  starsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  star: { padding: Spacing.half },
  required: { color: '#DC2626' },

  criterion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  thumbs: { flexDirection: 'row', gap: Spacing.two },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textArea: {
    minHeight: 104,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 15,
    lineHeight: 22,
  },

  reviewBlock: { gap: Spacing.two },
  reviewCriteria: { gap: Spacing.one },
  reviewCriterion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },

  bottomBar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
