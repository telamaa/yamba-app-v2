/**
 * notifications.tsx — la boîte aux lettres (D119).
 * ==================================================
 * Un écran POUSSÉ, pas un onglet : D114 a fait du carrefour « ce qui attend
 * un GESTE », et une notification est « ce qui s'est PASSÉ ». Les confondre
 * remplirait le carrefour de choses sur lesquelles il n'y a rien à faire.
 *
 * OUVRIR NE MARQUE RIEN (D119 4A). Contrairement au fil — où ouvrir une
 * conversation EST la lire — une liste parcourue des yeux n'a pas été lue :
 * vider la pastille à l'ouverture ferait perdre ce qu'on n'a pas eu le
 * temps de voir. On marque en TOUCHANT une ligne, ou avec « tout marquer
 * lu », qui est un bouton et non un effet de bord.
 *
 * La liste vient du contexte d'activité, qui la porte déjà : la cloche et
 * cet écran comptent la MÊME chose (doctrine D114).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import { BackButton } from '@/components/back-button';
import { IdentityGate } from '@/components/identity-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTopInset } from '@/hooks/use-top-inset';
import { marquerToutLu, marquerUneLue } from '@/lib/api/notifications.api';
import { useActivite } from '@/lib/activite-context';
import {
  ancienneteDe,
  cleDuLibelle,
  destinationDe,
  estLue,
  resteAMarquer,
  type NotificationDeLaBoite,
} from '@/lib/boite';
import { intlTagFor } from '@/lib/number-format';

function BoiteContent() {
  const t = useTranslations('notifications');
  const theme = useTheme();
  const topInset = useTopInset();
  const tag = intlTagFor(useLocale());
  const { notifications, notificationsNonLues, notificationsEnEchec, pret, rafraichir } =
    useActivite();

  const [occupe, setOccupe] = useState(false);

  // On relit à l'arrivée et à chaque retour : on revient ici après avoir
  // ouvert un deal depuis une ligne, et l'état a bougé.
  useFocusEffect(
    useCallback(() => {
      void rafraichir();
    }, [rafraichir])
  );

  const ouvrir = useCallback(
    async (notification: NotificationDeLaBoite) => {
      // Marquer AVANT de naviguer : on part, et la relecture au retour
      // verra le serveur. Un échec ne se dit pas — le pire qu'il arrive est
      // une pastille qui reste une minute de trop.
      if (!estLue(notification)) void marquerUneLue(notification.id).catch(() => undefined);

      const destination = destinationDe(notification);
      if (destination.ou === 'demande')
        router.push({ pathname: '/deal/[id]', params: { id: destination.id } });
      else if (destination.ou === 'envoi')
        router.push({ pathname: '/shipment/[id]', params: { id: destination.id } });
      else void rafraichir();
    },
    [rafraichir]
  );

  const toutMarquer = useCallback(async () => {
    if (occupe) return;
    setOccupe(true);
    try {
      await marquerToutLu();
      await rafraichir();
    } catch {
      // Silencieux : rien n'est perdu, la pastille reste.
    } finally {
      setOccupe(false);
    }
  }, [occupe, rafraichir]);

  return (
    <ThemedView style={styles.plein}>
      <SafeAreaView style={styles.plein} edges={['left', 'right', 'bottom']}>
        <View
          style={[
            styles.entete,
            { borderBottomColor: theme.backgroundElement, paddingTop: topInset + Spacing.two },
          ]}>
          <BackButton label={t('back')} onPress={() => router.back()} />
          <View style={styles.enteteTexte}>
            <ThemedText type="smallBold">{t('title')}</ThemedText>
            {notificationsNonLues > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('unread', { count: notificationsNonLues })}
              </ThemedText>
            ) : null}
          </View>
          {/* « Tout marquer lu » n'apparaît que s'il reste quelque chose à
              marquer : un bouton qui ne fait rien est un bouton de trop. */}
          {resteAMarquer(notifications) ? (
            <Pressable
              onPress={() => void toutMarquer()}
              accessibilityRole="button"
              accessibilityState={{ busy: occupe }}
              hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('markAll')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={
            notifications.length === 0 ? styles.videCorps : styles.listeCorps
          }
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Ligne notification={item} tag={tag} onPressAction={() => void ouvrir(item)} />
          )}
          ListEmptyComponent={
            // Une absence et une PANNE ne se disent pas pareil (D117).
            notificationsEnEchec ? (
              <View style={styles.vide}>
                <ThemedText type="smallBold" style={styles.centre}>
                  {t('loadError')}
                </ThemedText>
                <Pressable
                  onPress={() => void rafraichir()}
                  accessibilityRole="button"
                  style={[styles.reessayer, { borderColor: theme.backgroundElement }]}>
                  <ThemedText type="small">{t('retry')}</ThemedText>
                </Pressable>
              </View>
            ) : pret ? (
              <View style={styles.vide}>
                <ThemedText type="smallBold" style={styles.centre}>
                  {t('empty')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centre}>
                  {t('emptyWhy')}
                </ThemedText>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Ligne({
  notification,
  tag,
  onPressAction,
}: {
  notification: NotificationDeLaBoite;
  tag: string;
  onPressAction: () => void;
}) {
  const t = useTranslations('notifications');
  const theme = useTheme();
  const lue = estLue(notification);
  const mene = destinationDe(notification).ou !== 'nulle-part';
  const age = ancienneteDe(notification.creeeA, Date.now());

  // La clé est CALCULÉE : une fiche confronte la table des libellés à
  // l'union Zod du contrat, parce qu'un type sans libellé ferait lire son
  // CHEMIN au membre (leçon D83). Le repli reste pour l'événement que le
  // serveur déploiera avant l'app.
  const cle = cleDuLibelle(notification.type);
  const titre = t.has(`items.${cle}`) ? t(`items.${cle}`) : t('fallback');

  const sousTitre = [notification.prenomDeLAutre, notification.corridor]
    .filter((bout): bout is string => bout !== null && bout.length > 0)
    .join(' · ');

  return (
    <Pressable
      onPress={onPressAction}
      disabled={!mene}
      accessibilityRole={mene ? 'button' : 'text'}
      style={({ pressed }) => [
        styles.ligne,
        { borderBottomColor: theme.backgroundElement },
        pressed && mene && { backgroundColor: theme.backgroundElement },
      ]}>
      {/* La pastille de non-lu est la SEULE différence d'état : pas de
          fond coloré, qui ferait d'une boîte pleine un sapin de Noël. */}
      <View
        style={[styles.point, { backgroundColor: lue ? 'transparent' : Brand.mango }]}
      />
      <View style={styles.ligneCorps}>
        <ThemedText type={lue ? 'small' : 'smallBold'} numberOfLines={2}>
          {titre}
        </ThemedText>
        {sousTitre.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {sousTitre}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" style={styles.age}>
          {t(`age.${age.unite}`, { count: age.valeur })}
        </ThemedText>
      </View>
      {mene ? (
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  return (
    <IdentityGate destination="activity" onDismiss={() => router.back()}>
      <BoiteContent />
    </IdentityGate>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  enteteTexte: { flex: 1 },
  listeCorps: {
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  videCorps: { flexGrow: 1, justifyContent: 'center' },
  vide: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  centre: { textAlign: 'center' },
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  point: { width: 8, height: 8, borderRadius: 4 },
  ligneCorps: { flex: 1, gap: 2 },
  age: { fontSize: 11 },
});
