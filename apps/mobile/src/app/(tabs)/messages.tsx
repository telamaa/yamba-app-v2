/**
 * messages.tsx — la liste des conversations (D117).
 * ===================================================
 * Cet onglet était une coquille qui le disait elle-même (« Les conversations
 * arrivent dans un prochain lot »). Elle n'attendait pourtant pas une
 * requête : l'app recevait DÉJÀ la liste entière à chaque rafraîchissement
 * de l'activité et n'en lisait que `totalUnread` (D117 0A).
 *
 * LA LISTE VIENT DU CONTEXTE, pas d'une lecture à elle. C'est la doctrine
 * de D114 : une seule lecture, une seule vérité — un badge ne peut pas
 * annoncer autre chose que l'écran vers lequel il mène. Cet écran ajoute
 * seulement un SONDAGE pendant qu'on le regarde (D117 7A), et il s'arrête
 * dès qu'on le quitte : un sondage à 20 s dans la poche est une facture de
 * batterie, pas une fonctionnalité.
 *
 * La pastille Profil est présente ICI AUSSI : depuis A210 elle est le SEUL
 * accès au compte, elle doit donc exister sur les QUATRE destinations.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import { IdentityGate } from '@/components/identity-gate';
import { HeaderActions } from '@/components/header-actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useActivite } from '@/lib/activite-context';
import {
  RYTHME_DE_LA_LISTE_MS,
  conversationsLisibles,
  type ConversationDeLaListe,
} from '@/lib/fil';
import { intlTagFor } from '@/lib/number-format';

function MessagesContent() {
  const t = useTranslations('messaging');
  const theme = useTheme();
  const tag = intlTagFor(useLocale());
  const { conversations, conversationsEnEchec, pret, rafraichir } = useActivite();

  // Le sondage ne vit que pendant qu'on REGARDE l'écran (D117 7A).
  useFocusEffect(
    useCallback(() => {
      void rafraichir();
      const minuterie = setInterval(() => void rafraichir(), RYTHME_DE_LA_LISTE_MS);
      return () => clearInterval(minuterie);
    }, [rafraichir])
  );

  const fils = conversationsLisibles(conversations);

  const ouvrir = useCallback((id: string) => {
    router.push({ pathname: '/conversation/[id]', params: { id } });
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.titleRow}>
          <ThemedText type="title" style={styles.title}>
            {t('list.title')}
          </ThemedText>
          <HeaderActions />
        </View>

        <FlatList
          data={fils}
          keyExtractor={(fil) => fil.id}
          contentContainerStyle={fils.length === 0 ? styles.videCorps : styles.listeCorps}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <LigneDeConversation fil={item} tag={tag} onPressAction={() => ouvrir(item.id)} />
          )}
          ListEmptyComponent={
            // Une absence et une PANNE ne se disent pas avec la même phrase.
            // Sans cette distinction, un réseau coupé annoncerait « aucune
            // conversation » — le mensonge que le site a payé deux fois.
            conversationsEnEchec ? (
              <View style={styles.vide}>
                <ThemedText type="smallBold" style={styles.centre}>
                  {t('list.loadError')}
                </ThemedText>
                <Pressable
                  onPress={() => void rafraichir()}
                  accessibilityRole="button"
                  style={[styles.reessayer, { borderColor: theme.backgroundElement }]}>
                  <ThemedText type="small">{t('list.retry')}</ThemedText>
                </Pressable>
              </View>
            ) : pret ? (
              <View style={styles.vide}>
                <ThemedText type="smallBold" style={styles.centre}>
                  {t('list.empty')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centre}>
                  {t('list.emptyWhy')}
                </ThemedText>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function LigneDeConversation({
  fil,
  tag,
  onPressAction,
}: {
  fil: ConversationDeLaListe;
  tag: string;
  onPressAction: () => void;
}) {
  const t = useTranslations('messaging');
  const theme = useTheme();
  const nonLus = fil.nonLus > 0;

  // Le dernier message, préfixé « Toi : » quand c'est moi qui ai parlé —
  // sinon deux lignes voisines se lisent comme deux interlocuteurs.
  const apercu =
    fil.dernierMessage === null
      ? ''
      : fil.dernierMessage.roleAuteur === fil.monRole
        ? t('list.you', { body: fil.dernierMessage.corps })
        : fil.dernierMessage.corps;

  const heure =
    fil.dernierMessage === null
      ? ''
      : new Date(fil.dernierMessage.creeA).toLocaleDateString(tag, {
          day: 'numeric',
          month: 'short',
        });

  return (
    <Pressable
      onPress={onPressAction}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.ligne,
        { borderBottomColor: theme.backgroundElement },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <View style={[styles.pastille, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">
          {fil.interlocuteur.prenom.slice(0, 1).toUpperCase()}
        </ThemedText>
      </View>

      <View style={styles.ligneCorps}>
        <View style={styles.ligneHaut}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.nom}>
            {fil.interlocuteur.prenom}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {heure}
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {fil.corridor.depart} → {fil.corridor.arrivee}
        </ThemedText>

        <View style={styles.ligneBas}>
          <ThemedText
            type="small"
            themeColor={nonLus ? 'text' : 'textSecondary'}
            numberOfLines={1}
            style={[styles.apercu, nonLus && styles.apercuNonLu]}>
            {apercu}
          </ThemedText>
          {nonLus ? (
            <View style={[styles.compteur, { backgroundColor: Brand.mango }]}>
              <ThemedText type="small" style={styles.compteurTexte}>
                {fil.nonLus.toLocaleString(tag)}
              </ThemedText>
            </View>
          ) : null}
          {/* Une conversation close se DIT dans la liste : on sait avant
              d'entrer qu'on ne pourra pas répondre. */}
          {!fil.acces.peutEcrire ? (
            <Ionicons name="lock-closed" size={11} color={theme.textSecondary} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  return (
    <IdentityGate destination="messages">
      <MessagesContent />
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
    width: '100%',
    paddingHorizontal: Spacing.four,
    // La barre d'onglets FLOTTE au-dessus du contenu (D88).
    paddingBottom: BottomTabInset,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  title: {
    flexShrink: 1,
  },
  listeCorps: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  videCorps: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  vide: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  centre: {
    textAlign: 'center',
  },
  reessayer: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pastille: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligneCorps: {
    flex: 1,
    gap: 2,
  },
  ligneHaut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  nom: {
    flexShrink: 1,
  },
  ligneBas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  apercu: {
    flex: 1,
  },
  apercuNonLu: {
    fontFamily: Font.semibold,
  },
  compteur: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compteurTexte: {
    color: '#1A1A1A',
    fontFamily: Font.bold,
  },
});
