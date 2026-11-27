/**
 * activity.tsx — l'onglet « Activité », CARREFOUR des deux faces (D114).
 * ========================================================================
 * Il listait des PORTES. Une porte dit où aller ; elle ne dit pas ce qu'il
 * faut faire, ni dans quel ordre. Quelqu'un qui avait un colis à confirmer,
 * une demande expirant dans deux heures et un Voyageur à noter devait
 * ouvrir trois écrans pour l'apprendre.
 *
 * Il montre donc d'abord CE QUI L'ATTEND, les deux rôles confondus et
 * ordonnés (`lib/carrefour.ts`), puis les portes, puis l'invitation à
 * publier. Et quand rien n'attend, il le DIT — « tout est à jour » est une
 * bonne nouvelle, pas un écran vide.
 *
 * ── ancien en-tête ──────────────────────────────────────────────────────
 * activity.tsx — l'onglet « Activité » (ex-« Trajets », A210).
 * ============================================================
 * Il sert les DEUX faces : les envois de l'Expéditeur, les trajets publiés
 * et les demandes reçues du Voyageur. « Trajets » ne parlait qu'à une face
 * et laissait croire à des résultats de recherche — d'où le renommage.
 *
 * Derrière la porte d'identité. La coquille montre des chiffres VRAIS (les
 * mêmes que le badge d'onglet) ; le détail est un lot à part.
 *
 * C'est aussi la PORTE UNIQUE de « Publier » depuis qu'il a quitté la barre
 * (A210 e) : le domicile du Voyageur, le seul endroit où il revient. La
 * carte dit honnêtement que le parcours arrive — elle ne renvoie NULLE PART,
 * l'app est full native (A210 b).
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { Ionicons } from '@expo/vector-icons';

import { IdentityGate } from '@/components/identity-gate';
import { HeaderActions } from '@/components/header-actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useActivite, useTabBadges } from '@/lib/activite-context';
import { choseQuiAttendent, teteDePile, type ChoseQuiAttend } from '@/lib/carrefour';
import { remainingLabel, remainingUntil } from '@/lib/shipment-view';
import { useSession } from '@/lib/session-context';

function ActivityContent() {
  const t = useTranslations('tabs');
  // Le décompte parle le dictionnaire de l'écran de suivi : un même délai ne
  // s'écrit pas de deux façons selon l'écran qui le montre.
  const tc = useTranslations('shipment');
  const { user } = useSession();
  const badges = useTabBadges();
  const { envois, demandes, pret } = useActivite();
  const isCarrier = user?.roles.includes('CARRIER') ?? false;

  const attendent = choseQuiAttendent(envois, demandes);
  const { visibles, reste } = teteDePile(attendent);

  /** Une ligne du carrefour : ce qu'il y a à faire, et où cela mène. */
  function Attente({ chose }: { chose: ChoseQuiAttend }) {
    const nom =
      chose.type === 'repondre' || chose.type === 'prendre' || chose.type === 'remettre'
        ? chose.demande.expediteur
        : chose.type === 'noter'
          ? chose.envoi.voyageur
          : '';
    const quelquun = nom || t('activity.waitingSomeone');
    const libelle =
      chose.type === 'repondre'
        ? t('activity.waitingRepondre', { name: quelquun })
        : chose.type === 'prendre'
          ? t('activity.waitingPrendre', { name: quelquun })
          : chose.type === 'remettre'
            ? t('activity.waitingRemettre', { name: quelquun })
            : chose.type === 'noter'
              ? t('activity.waitingNoter', { name: quelquun })
              : t('activity.waitingConfirmer');

    // Recalculé au rendu, pas à la seconde.
    const left = chose.echeance ? remainingUntil(chose.echeance, Date.now()) : null;

    const aller = () => {
      if (chose.type === 'repondre')
        router.push({ pathname: '/deal/[id]', params: { id: chose.id } });
      // La prise en charge mène à l'INSPECTION, pas à la demande : le geste
      // se fait colis en main, et un écran de plus à traverser est un geste
      // de trop quand quelqu'un attend debout.
      else if (chose.type === 'prendre')
        router.push({ pathname: '/deal/[id]/pickup', params: { id: chose.id } });
      else if (chose.type === 'remettre')
        router.push({ pathname: '/deal/[id]/deliver', params: { id: chose.id } });
      else if (chose.type === 'noter')
        router.push({ pathname: '/shipment/[id]/rate', params: { id: chose.id } });
      else router.push({ pathname: '/shipment/[id]', params: { id: chose.id } });
    };

    return (
      <Pressable
        accessibilityRole="button"
        onPress={aller}
        style={({ pressed }) => [styles.attente, pressed && styles.pressed]}>
        <View style={styles.attenteTexte}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {libelle}
          </ThemedText>
          {left !== null && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('activity.waitingIn', {
                remaining: tc(`countdown.${remainingLabel(left).key}`, remainingLabel(left).values),
              })}
            </ThemedText>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={Brand.mango} />
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.titleRow}>
          {/* `title` et non `subtitle` : le même cran que la porte
              d'identité, pour que le nom de la page ne saute pas d'une taille
              à l'autre au moment où la session s'ouvre. */}
          <ThemedText type="title" style={styles.title}>
            {t('activity.title')}
          </ThemedText>
          <HeaderActions />
        </View>

        {/* ① CE QUI T'ATTEND. En tête, parce que c'est la seule chose de cet
            écran qui soit URGENTE — les portes, elles, ne bougent pas. La
            section DISPARAÎT quand rien n'attend : un bandeau « 0 » posé en
            permanence n'est pas un signal, et ce dépôt l'a déjà payé trois
            fois. */}
        {attendent.length > 0 ? (
          <View style={styles.bloc}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('activity.waitingTitle')}
            </ThemedText>
            {visibles.map((chose) => (
              <Attente key={`${chose.type}-${chose.id}`} chose={chose} />
            ))}
            {reste > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('activity.waitingMore', { count: reste })}
              </ThemedText>
            )}
          </View>
        ) : (
          pret && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('activity.nothingWaiting')}
            </ThemedText>
          )
        )}

        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('activity.doorsTitle')}
        </ThemedText>

        {/* D112 — LA FACE EXPÉDITEUR, qui n'existait pas. `isCarrier &&`
            masquait les seuls compteurs de l'écran : un compte sans rôle
            Voyageur ne voyait qu'une phrase d'attente et une invitation à
            devenir Voyageur, sur l'onglet censé servir « les deux faces ».
            Cette porte est ouverte à TOUT LE MONDE — tout compte peut
            envoyer, et c'est par ici qu'on retrouve le suivi d'un colis. */}
        <View style={styles.counters}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/shipments/mine')}
            style={({ pressed }) => [styles.lien, pressed && styles.pressed]}>
            <ThemedText type="smallBold">{t('activity.myShipments')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.lienCompte}>
              {t('activity.shipmentsToHandle', { count: badges.shipmentsToHandle })}
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={Brand.mango} />
          </Pressable>
        </View>

        {isCarrier && (
          <View style={styles.counters}>
            {/* D113 — le compteur de demandes MÈNE quelque part. Il affichait
                un nombre depuis le lot « onglets » sans que rien ne permette
                d'y aller : troisième fois que ce dépôt paie le même défaut,
                et la plus chère — une demande meurt en 24 h (DEA-01). */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/deals/mine')}
              style={({ pressed }) => [styles.lien, pressed && styles.pressed]}>
              <ThemedText type="smallBold">{t('activity.myDeals')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.lienCompte}>
                {t('activity.pendingDeals', { count: badges.pendingDeals })}
              </ThemedText>
              <Ionicons name="chevron-forward" size={16} color={Brand.mango} />
            </Pressable>

            {/* D111 quinquies — le compteur de brouillons MÈNE quelque part.
                Il affichait un nombre depuis le lot « onglets » sans que rien
                ne permette d'y aller : un chiffre sur lequel on ne peut pas
                taper est une information qui se périme toute seule. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/trips/mine')}
              style={({ pressed }) => [styles.lien, pressed && styles.pressed]}>
              <ThemedText type="smallBold">{t('activity.myTrips')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.lienCompte}>
                {t('activity.draftTrips', { count: badges.draftTrips })}
              </ThemedText>
              <Ionicons name="chevron-forward" size={16} color={Brand.mango} />
            </Pressable>
          </View>
        )}

        {/* La porte de « Publier ». Le bouton est né AVEC le formulaire, et
            actif du premier jour — c'est ce que cette carte promettait depuis
            le lot « onglets » : « le bouton naîtra avec le formulaire ». La
            ligne « arrive dans un prochain lot » a disparu le même jour : une
            coquille honnête cesse de l'être le jour où elle ment. */}
        <ThemedView type="backgroundElement" style={styles.publishCard}>
          <View style={[styles.publishIcon, { backgroundColor: 'rgba(255,153,0,0.16)' }]}>
            <Ionicons name="airplane-outline" size={22} color={Brand.mango} />
          </View>
          <ThemedText type="smallBold">{t('activity.publishTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('activity.publishBody')}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/publish-trip')}
            style={({ pressed }) => [styles.publishCta, { opacity: pressed ? 0.85 : 1 }]}>
            <ThemedText type="smallBold" style={styles.publishCtaLabel}>
              {t('activity.publishCta')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

export default function ActivityScreen() {
  return (
    <IdentityGate destination="activity">
      <ActivityContent />
    </IdentityGate>
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
    gap: Spacing.three,
    // La barre d'onglets FLOTTE au-dessus du contenu (D88) : cet écran ne
    // défile pas, c'est donc ici qu'il lui réserve sa place — sans quoi son
    // bas se centrerait SOUS la pilule.
    paddingBottom: BottomTabInset,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flexShrink: 1,
    paddingTop: Spacing.two,
  },
  counters: {
    gap: Spacing.two,
  },
  bloc: {
    gap: Spacing.two,
  },
  attente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  attenteTexte: {
    flex: 1,
    minWidth: 0,
  },
  lien: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  lienCompte: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  publishCta: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  publishCtaLabel: {
    color: '#1A1A1A',
    fontSize: 15,
  },
  publishCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  publishIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
