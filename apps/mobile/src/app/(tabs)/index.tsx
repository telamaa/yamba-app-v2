/**
 * index.tsx — l'onglet Accueil (lot accueil D36).
 * ================================================
 * L'accueil du produit, transposé de l'accueil web refondu (#357) : une page
 * qui ne dit QUE du vrai. Hero (l'accroche du site) + CTA vers l'onglet
 * Rechercher — pas de barre de recherche dupliquée : la recherche EST un
 * onglet —, ligne de confiance (les mécanismes réels, pas des chiffres),
 * corridors dérivés des trajets PUBLIÉS (même échantillon que le web :
 * `GET /trips/search` limit 50, agrégation à l'affichage), « comment ça
 * marche » à deux faces. Zéro trajet ou API en panne → la section corridors
 * DISPARAÎT, elle ne montre jamais du faux. Un corridor touché ouvre
 * Rechercher PRÉREMPLI (paramètres de route + graine, la recherche part
 * d'elle-même). Connecté : salutation par le prénom.
 */
import { useEffect, useState } from 'react';
import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchTrips, type TripSearchResult } from '@/lib/api/search.api';
import { useSession } from '@/lib/session-context';

/** Même dérivation que `CorridorsSection` du web (miroir assumé, cf. A206). */
const MAX_CORRIDORS = 6;
const CORRIDORS_SAMPLE = 50;

type Corridor = { fromCity: string; toCity: string; count: number };

function deriveCorridors(trips: TripSearchResult[]): Corridor[] {
  const byKey = new Map<string, Corridor>();
  for (const trip of trips) {
    const key = `${trip.fromCity}→${trip.toCity}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, { fromCity: trip.fromCity, toCity: trip.toCity, count: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count).slice(0, MAX_CORRIDORS);
}

const TRUST_KEYS = ['escrow', 'code', 'verified'] as const;
const SEND_STEPS = ['find', 'book', 'handoff', 'delivered'] as const;
const TRAVEL_STEPS = ['publish', 'accept', 'deliver', 'paid'] as const;
type Face = 'send' | 'travel';

export default function HomeScreen() {
  const t = useTranslations('home');
  const theme = useTheme();
  const { status, user } = useSession();
  // null tant que rien de vrai à montrer (chargement, panne, zéro trajet).
  const [corridors, setCorridors] = useState<Corridor[] | null>(null);
  const [face, setFace] = useState<Face>('send');

  useEffect(() => {
    let cancelled = false;
    searchTrips({ limit: CORRIDORS_SAMPLE })
      .then((page) => {
        if (cancelled) return;
        const derived = deriveCorridors(page.trips);
        setCorridors(derived.length > 0 ? derived : null);
      })
      .catch(() => {
        // API en panne : la section reste absente, l'accueil ne casse pas.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openSearch = () => router.navigate('/(tabs)/search');

  const openCorridor = (corridor: Corridor) => {
    // La graine change à chaque toucher : Rechercher rejoue le préremplissage
    // même quand on retape le même corridor.
    router.navigate({
      pathname: '/(tabs)/search',
      params: {
        from: corridor.fromCity,
        to: corridor.toCity,
        seed: Date.now().toString(36),
      },
    });
  };

  const steps = face === 'send' ? SEND_STEPS : TRAVEL_STEPS;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <ThemedText type="title" style={styles.brand}>
              Yamba
            </ThemedText>
            <ThemedText type="subtitle" style={styles.centered}>
              {t('tagline')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {t('subtitle')}
            </ThemedText>

            {status === 'authenticated' && user !== null && (
              <ThemedText type="smallBold" style={styles.centered}>
                {t('greeting', { firstName: user.firstName })}
              </ThemedText>
            )}

            <Pressable
              onPress={openSearch}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <ThemedText style={styles.ctaLabel}>{t('searchCta')}</ThemedText>
            </Pressable>

            {status === 'anonymous' && (
              <Link href="/login" asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">{t('login')}</ThemedText>
                </Pressable>
              </Link>
            )}
          </View>

          <View style={styles.trustLine}>
            {TRUST_KEYS.map((key) => (
              <View key={key} style={styles.trustRow}>
                <ThemedText type="smallBold" style={{ color: theme.tint }}>
                  ✓
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.trustLabel}>
                  {t(`trust.${key}`)}
                </ThemedText>
              </View>
            ))}
          </View>

          {corridors !== null && (
            <View style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                {t('corridors.label')}
              </ThemedText>
              <ThemedText type="smallBold">{t('corridors.title')}</ThemedText>
              <View style={styles.corridorList}>
                {corridors.map((corridor) => (
                  <Pressable
                    key={`${corridor.fromCity}→${corridor.toCity}`}
                    onPress={() => openCorridor(corridor)}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedView type="backgroundElement" style={styles.corridorChip}>
                      <ThemedText type="smallBold" style={styles.corridorRoute} numberOfLines={1}>
                        {corridor.fromCity} <ThemedText style={styles.arrow}>→</ThemedText>{' '}
                        {corridor.toCity}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('corridors.tripCount', { count: corridor.count })}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="smallBold">{t('how.title')}</ThemedText>
            <View style={styles.faces}>
              {(['send', 'travel'] as const).map((candidate) => {
                const selected = face === candidate;
                return (
                  <Pressable
                    key={candidate}
                    onPress={() => setFace(candidate)}
                    style={[
                      styles.faceChip,
                      { backgroundColor: selected ? Brand.mango : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" style={selected ? styles.faceLabelSelected : undefined}>
                      {t(`how.faces.${candidate}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.steps}>
              {steps.map((step, index) => (
                <View key={step} style={styles.step}>
                  <View style={styles.stepBullet}>
                    <ThemedText type="smallBold" style={styles.stepNumber}>
                      {index + 1}
                    </ThemedText>
                  </View>
                  <View style={styles.stepBody}>
                    <ThemedText type="smallBold">{t(`how.${face}.${step}.title`)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(`how.${face}.${step}.description`)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scroll: {
    gap: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  heroSection: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  brand: {
    color: Brand.mango,
  },
  centered: {
    textAlign: 'center',
  },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  ctaLabel: {
    color: '#ffffff',
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
  trustLine: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'baseline',
  },
  trustLabel: {
    flexShrink: 1,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
  },
  corridorList: {
    gap: Spacing.two,
  },
  corridorChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  corridorRoute: {
    flexShrink: 1,
  },
  arrow: {
    color: Brand.mango,
  },
  faces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  faceChip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  faceLabelSelected: {
    color: '#ffffff',
    fontWeight: 700,
  },
  steps: {
    gap: Spacing.three,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  stepBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Brand.mango,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    color: '#ffffff',
  },
  stepBody: {
    flex: 1,
    gap: Spacing.half,
  },
});
