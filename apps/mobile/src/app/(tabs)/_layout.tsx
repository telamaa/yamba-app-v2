/**
 * (tabs)/_layout.tsx — le groupe d'onglets.
 * =========================================
 * CINQ ROUTES, DONT UNE ACTION — la barre cible (A210) :
 *
 *     Accueil · Favoris · [ + ] · Activité · Messages
 *
 * Le « + » n'est pas une destination : c'est l'action de PUBLIER, logée au
 * centre de la barre — le motif de Vinted, Leboncoin, Instagram. Il est là
 * parce que le goulot d'une place de marché est l'OFFRE, et que celle de
 * Yamba est *casual* : la même personne envoie un colis, puis transporte
 * quand elle voyage. Son icône est une MARQUE et non un pictogramme — un
 * « + » balayé par un ARC qui se termine par un point, les deux grands arcs
 * du splash (« le réseau des corridors ») réduits à un geste : publier, c'est
 * mettre un trajet sur le réseau. Elle est servie en image (le squircle en
 * dégradé mangue, en @1x/@2x/@3x) et reste la seule tache chaude et saturée
 * de la barre : l'œil la lit comme une ACTION avant d'avoir lu le mot.
 *
 * **Profil a quitté la barre** au profit du « + ». Il se POUSSE au-dessus des
 * onglets depuis la pastille d'angle (`ProfileAvatarButton`), présente sur
 * Accueil, Favoris et Activité dans une rangée qui EXISTE DÉJÀ — zéro hauteur
 * ajoutée. C'est le motif Gmail / Spotify / Revolut : un compte se visite
 * délibérément, il ne se navigue pas.
 *
 * Les quatre destinations hors Accueil sont derrière la porte d'identité
 * (A58/A63) : l'onglet reste VISIBLE et montre la porte.
 *
 * LA BARRE N'EST PLUS NATIVE (D88). `NativeTabs` est remplacé par le
 * navigateur JS et une barre DESSINÉE (`components/tab-bar.tsx`) : pilule
 * flottante, icônes seules, le mot sur le seul onglet actif, escamotage au
 * défilement. Le pourquoi — trois demandes hors d'atteinte du natif, et ce
 * qu'on paie en échange — est gravé dans ce fichier-là, au plus près du code
 * qui le porte.
 *
 * CE FICHIER NE FAIT DONC PLUS QUE DEUX CHOSES : déclarer l'ORDRE des cinq
 * routes (sans ces déclarations, expo-router suivrait l'ordre alphabétique
 * des fichiers et la barre lirait « Activité · Favoris · Accueil · Messages ·
 * Publier »), et ouvrir la valeur partagée d'escamotage pour que la barre et
 * les écrans la partagent.
 */
import { Tabs } from 'expo-router/js-tabs';

import { YambaTabBar } from '@/components/tab-bar';
import { TabBarVisibilityProvider } from '@/lib/tab-bar-visibility';

export default function TabsLayout() {
  return (
    <TabBarVisibilityProvider>
      <Tabs
        tabBar={(props) => <YambaTabBar {...props} />}
        // Le navigateur JS monte un en-tête par défaut, là où `NativeTabs`
        // n'en avait pas : chaque écran porte déjà son propre titre.
        screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="favorites" />
        <Tabs.Screen name="publish" />
        <Tabs.Screen name="activity" />
        <Tabs.Screen name="messages" />
      </Tabs>
    </TabBarVisibilityProvider>
  );
}
