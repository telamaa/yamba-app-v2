/**
 * (tabs)/_layout.tsx — les onglets natifs (lot tabs D36).
 * =======================================================
 * `NativeTabs` d'expo-router : la VRAIE barre de chaque OS (UITabBar iOS —
 * flou, liquid glass sur iOS 26 —, Material 3 sur Android), pas une imitation
 * JS — le thème sombre et le tactile sont idiomatiques d'office. Icônes SF
 * Symbols (iOS) + Material Symbols (Android), variante pleine à la sélection.
 *
 * QUATRE DESTINATIONS + UNE ACTION — la barre cible (A210) :
 *
 *     Explorer · Favoris · [ + ] · Activité · Messages
 *
 * Le « + » n'est pas une destination : c'est l'action de PUBLIER, logée au
 * centre de la barre — le motif de Vinted, Leboncoin, Instagram. Il est
 * là parce que le goulot d'une place de marché est l'OFFRE, et que celle
 * de Yamba est *casual* : la même personne envoie un colis, puis transporte
 * quand elle voyage. Son icône est PLEINE dans les deux états (`plus.circle
 * .fill`), ce qui la distingue à l'œil des quatre icônes de navigation.
 *
 * **Profil a quitté la barre** au profit du « + ». Il se POUSSE au-dessus
 * des onglets depuis la pastille d'angle (`ProfileAvatarButton`), présente
 * sur Explorer, Favoris et Activité dans une rangée qui EXISTE DÉJÀ —
 * zéro hauteur ajoutée. C'est le motif Gmail / Spotify / Revolut : un
 * compte se visite délibérément, il ne se navigue pas.
 *
 * Les quatre destinations hors Explorer sont derrière la porte d'identité
 * (A58/A63) : l'onglet reste VISIBLE et montre la porte.
 *
 * ICÔNES — l'alignement web n'est PAS une justification (leçon du 11/10) :
 * chaque symbole est choisi pour ce que l'onglet contient.
 *   • Explorer  `magnifyingglass` — la loupe, sans variante pleine.
 *   • Favoris   `heart` → `heart.fill` : MÊME symbole que le geste de la
 *     carte de résultat, à dessein — le cœur ENSEIGNE la destination.
 *   • Publier   une MARQUE, pas un pictogramme. Le « + » est entouré d'un
 *     ARC qui le balaie et se termine par un point : c'est le motif des
 *     CORRIDORS de Yamba — les deux grands arcs du splash (`app-splash.tsx`,
 *     « le réseau des corridors ») réduits à un geste, avec le colis qui
 *     file dessus. Publier, c'est mettre un trajet sur le réseau : l'icône
 *     le DIT, au lieu d'être un plus de catalogue.
 *     Artisanat : squircle en dégradé mangue (#FFB747 → #F08000, la lumière
 *     en haut, le poids en bas), rayon à 30 % du côté (la courbure continue
 *     d'iOS — ça se lit comme un bouton, pas comme un glyphe) ; le « + »
 *     blanc est posé sur un DÉTOURAGE mangue légèrement plus épais, pour
 *     que l'arc ne le touche jamais — ce vide fait toute la profondeur.
 *     Servie en `src` + `renderingMode: 'original'` : c'est ce mode qui lui
 *     laisse SES couleurs, une barre native repeignant sinon toute icône
 *     dans sa teinte. 30 pt (le maximum confortable d'une barre iOS), en
 *     @1x/@2x/@3x pour que Metro serve la bonne densité ; dessinée avec
 *     Pillow ×8 puis réduite en Lanczos (Pillow ne lisse pas un arrondi à
 *     30 px), lisibilité vérifiée jusqu'au @1x. Son libellé passe en mangue
 *     à la sélection (`selectedStyle` — l'API n'expose pas le style non
 *     sélectionné par onglet). Une seule tache chaude et saturée au milieu
 *     de quatre glyphes de contour : l'œil la lit comme une ACTION avant
 *     même d'avoir lu le mot.
 *   • Activité  `shippingbox` → `.fill` : le COLIS, objet partagé par les
 *     deux faces et objet de marque. (L'éclair `Zap` du tableau de bord web
 *     a été écarté : il ne dit rien de Yamba sur une barre d'onglets.)
 *   • Messages  `bubble.left.and.bubble.right` → `.fill` : DEUX bulles, un
 *     DIALOGUE — ce qu'est le chantier F.
 * Tous les noms SF sont validés contre `sf-symbols-typescript@2.2.0` ; les
 * Material Symbols restent à vérifier au poste Android.
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
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>{t('bar.search')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites">
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="favorite" />
        <NativeTabs.Trigger.Label>{t('bar.favorites')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="publish">
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tab-publish.png')}
          renderingMode="original"
        />
        {/* `labelStyle` n'est pas exposé par onglet — seul `selectedStyle`
            l'est. Le poids visuel vient donc de l'ICÔNE, pas du mot. */}
        <NativeTabs.Trigger.Label selectedStyle={{ color: Brand.mango, fontWeight: '700' }}>
          {t('bar.publish')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }}
          md="package_2"
        />
        <NativeTabs.Trigger.Label>{t('bar.activity')}</NativeTabs.Trigger.Label>
        {activityBadge > 0 && (
          <NativeTabs.Trigger.Badge>{badgeLabel(activityBadge)}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'bubble.left.and.bubble.right',
            selected: 'bubble.left.and.bubble.right.fill',
          }}
          md="forum"
        />
        <NativeTabs.Trigger.Label>{t('bar.messages')}</NativeTabs.Trigger.Label>
        {badges.unreadMessages > 0 && (
          <NativeTabs.Trigger.Badge>{badgeLabel(badges.unreadMessages)}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
