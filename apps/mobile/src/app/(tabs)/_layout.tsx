/**
 * (tabs)/_layout.tsx — les onglets natifs (lot tabs D36).
 * =======================================================
 * `NativeTabs` d'expo-router : la VRAIE barre de chaque OS (UITabBar iOS —
 * flou, liquid glass sur iOS 26 —, Material 3 sur Android), pas une imitation
 * JS — le thème sombre et le tactile sont idiomatiques d'office. Icônes SF
 * Symbols (iOS) + Material Symbols (Android), variante pleine à la sélection.
 *
 * Cinq onglets plein-app : Accueil, Rechercher (publics), Trajets, Messages,
 * Profil (derrière la porte d'identité — la porte est DANS l'écran, l'onglet
 * reste visible : on montre la porte, jamais un onglet caché). La barre du
 * dashboard web (#355) est celle d'un espace membre ; la correspondance est
 * documentée au registre (A203).
 *
 * Badges : « à traiter » du Voyageur (A44) sur Trajets, non-lus serveur sur
 * Messages — même plafond d'affichage « 9+ » que la barre web.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { useTranslations } from 'use-intl';

import { Brand } from '@/constants/theme';
import { useTabBadges } from '@/hooks/use-tab-badges';

function badgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count);
}

export default function TabsLayout() {
  const t = useTranslations('tabs');
  const colorScheme = useColorScheme();
  const badges = useTabBadges();
  const activityBadge = badges.pendingDeals + badges.draftTrips;

  return (
    <NativeTabs
      // Mangue assombrie sur fond clair (le choix de contraste de la barre
      // web), mangue pleine sur fond sombre. Le fond reste celui de l'OS.
      tintColor={colorScheme === 'dark' ? Brand.mango : Brand.mangoDark}
      badgeBackgroundColor={Brand.mango}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>{t('bar.home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>{t('bar.search')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trips">
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
        <NativeTabs.Trigger.Label>{t('bar.trips')}</NativeTabs.Trigger.Label>
        {activityBadge > 0 && (
          <NativeTabs.Trigger.Badge>{badgeLabel(activityBadge)}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="chat"
        />
        <NativeTabs.Trigger.Label>{t('bar.messages')}</NativeTabs.Trigger.Label>
        {badges.unreadMessages > 0 && (
          <NativeTabs.Trigger.Badge>{badgeLabel(badges.unreadMessages)}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="person"
        />
        <NativeTabs.Trigger.Label>{t('bar.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
