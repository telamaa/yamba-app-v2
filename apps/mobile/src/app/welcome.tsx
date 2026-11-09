/**
 * welcome.tsx — l'atterrissage d'ouverture : la marque, trois promesses, deux gestes.
 * ====================================================================================
 * Créneau inchangé depuis A208 : lancement à FROID en anonyme seulement —
 * jamais un membre connecté, jamais deux fois par session (`welcome-state`,
 * non persisté).
 *
 * D86 — L'ÉCRAN EST ANCRÉ EN BAS, ET LE DISCOURS DÉFILE.
 *
 * ① L'ANCRAGE PLUTÔT QUE LE CENTRAGE. La composition précédente (symbole,
 *    mot, promesse, boutons) était centrée et symétrique : elle se lisait
 *    comme une page de garde. Tout le contenu est désormais poussé EN BAS,
 *    aligné à gauche, le vide étant rejeté d'un bloc vers le haut — la
 *    composition des onboardings d'application (SumUp, Revolut, Bolt). Un
 *    seul espaceur `flex: 1` en tête suffit à produire cet ancrage : il n'y a
 *    plus de centre optique à corriger.
 *
 * ② PAS DE PHOTOGRAPHIE, ET C'EST UN CHOIX. La référence tient sur une image
 *    plein cadre ; ici le fond reste le marine plein. Le vide du haut n'est
 *    donc pas un décor manquant, c'est le silence qui donne du poids au bloc
 *    ancré — mais il impose une contrainte : sans image, un seul argument
 *    peut tenir l'écran à la fois.
 *
 * ③ D'OÙ LE CARROUSEL, qui est structurel et non décoratif. Yamba a deux
 *    publics (Expéditeur, Voyageur) et trois arguments ; les empiler sur un
 *    écran redonne la liste à puces qu'on vient de retirer. Un volet par
 *    argument, en grand. Quatre règles le rendent civilisé :
 *      • les BOUTONS NE DÉFILENT PAS — seul le texte bouge, sinon l'écran
 *        devient un tutoriel qu'il faut finir avant d'entrer ;
 *      • le défilement automatique s'arrête DÉFINITIVEMENT au premier geste
 *        (on ne se bat pas avec quelqu'un qui a pris la main) ;
 *      • il ne démarre pas du tout si « Réduire les animations » est actif ;
 *      • trois points cliquables disent combien il y a de volets et
 *        permettent d'y revenir.
 *
 * ④ UN TITRE ÉNORME, UN CORPS EN RETRAIT. Les coupures des titres sont
 *    ÉCRITES (`\n` dans les dictionnaires) et non subies : à 34 px, « pas un
 *    trajet de plus » ne tient pas sur la largeur d'un iPhone, et laisser le
 *    moteur couper produit des mots orphelins. Une traduction déplace ses
 *    propres retours.
 *
 * ⑤ LE BOUTON PRIMAIRE EST MANGO. C'est la charte (§3.4, citée dans
 *    `packages/libs/email/src/layout.ts`) : mango = AVANCER. Son libellé est
 *    en marine et non en blanc : du blanc sur du mango tombe sous 3:1 de
 *    contraste, c'est illisible au soleil. La pile des trois gestes est
 *    conservée telle quelle (primaire pleine largeur, secondaire en contour,
 *    lien centré) : deux boutons côte à côte comme la référence les mettrait
 *    à égalité, alors que l'inscription est l'action poussée.
 *
 * ⑥ « VOIR LES TRAJETS SANS COMPTE » EN BAS. C'était un ✕ en haut à droite,
 *    puis « Passer et parcourir les trajets » — qui nommait le renoncement
 *    plutôt que la récompense. Le libellé actuel lève l'objection du moment
 *    (« il va falloir s'inscrire ») au lieu de la contourner. L'app reste
 *    publique (A203) : recherche large à l'arrivée.
 *
 * D88 — L'ÉCRAN SUIT LE THÈME. Il était figé en sombre « hors thème » : ouvrir
 * sur un marine profond pour atterrir sur une première page blanche est une
 * rupture que rien ne justifie. Il obéit désormais au réglage du système comme
 * tout le reste de l'app — fond, textes, contours ET variante du symbole.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBar } from 'expo-status-bar';

import { useTranslations } from 'use-intl';

import {
  InviteActions,
  InviteBody,
  InviteHeadline,
  InviteLockup,
  InvitePrimary,
  InviteSecondary,
  InviteTertiary,
  InviteGutter,
  useInviteColors,
} from '@/components/invite-kit';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session-context';
import { dismissWelcome, requestBrowseOnLanding } from '@/lib/welcome-state';

/** L'ordre des volets EST la hiérarchie du discours : qui envoie, qui porte, pourquoi ça tient. */
const SLIDES = ['shipper', 'traveler', 'model'] as const;

/**
 * 8 s par volet, et le chiffre se calcule plutôt qu'il ne se devine.
 *
 * Le volet le plus chargé fait environ 15 mots (titre + corps). À 200 mots par
 * minute — la vitesse d'une lecture attentive, pas d'un survol — il demande
 * 4,5 s de lecture pure. S'y ajoutent le temps de poser l'œil sur un écran
 * qu'on découvre à froid et celui de la transition. 5 s coupaient la lecture
 * en cours (constaté à l'écran) ; 8 s laissent finir, et personne n'attend
 * jamais plus de 8 s puisque le geste prend la main immédiatement.
 */
const SLIDE_MS = 8000;

export default function WelcomeScreen() {
  const t = useTranslations('welcome');
  const { status } = useSession();
  const { width } = useWindowDimensions();
  // Les teintes du modèle (`invite-kit`) : cet écran les a définies, la porte
  // d'identité les partage désormais.
  const c = useInviteColors();

  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  // Connexion réussie depuis la feuille d'auth : l'écran a rempli son office.
  useEffect(() => {
    if (status === 'authenticated') {
      dismissWelcome();
      router.replace('/(tabs)');
    }
  }, [status]);

  // « Réduire les animations » (iOS et Android) : on ne fait RIEN bouger tout
  // seul. Lecture asynchrone, d'où le garde-fou de démontage.
  useEffect(() => {
    let monte = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduit) => {
        if (monte && reduit) setAutoplay(false);
      })
      .catch(() => {
        /* Réglage illisible : on garde le comportement par défaut. */
      });
    return () => {
      monte = false;
    };
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const minuteur = setInterval(() => {
      setIndex((courant) => {
        const suivant = (courant + 1) % SLIDES.length;
        pager.current?.scrollTo({ x: suivant * width, animated: true });
        return suivant;
      });
    }, SLIDE_MS);
    return () => clearInterval(minuteur);
  }, [autoplay, width]);

  // La position RÉELLE après un geste : c'est elle qui fait foi, pas l'état.
  const onPaged = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const goTo = (i: number) => {
    setAutoplay(false);
    setIndex(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };

  const browse = () => {
    dismissWelcome();
    // Résultats DIRECTS derrière le geste (motif Airbnb) : Rechercher lance la
    // recherche large à l'arrivée — de vrais trajets, pas un formulaire vide.
    requestBrowseOnLanding();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* `auto` et non une valeur figée : l'heure et la batterie doivent
          s'inverser avec le fond, sinon elles disparaissent dans l'un des
          deux thèmes. */}
      <StatusBar style="auto" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* TOUT le vide est ici : c'est lui qui ancre le bloc en bas. */}
        <View style={styles.spacer} />

        <InviteLockup />

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setAutoplay(false)}
          onMomentumScrollEnd={onPaged}
          style={styles.pager}>
          {SLIDES.map((slide) => (
            <View key={slide} style={[styles.slide, { width }]}>
              <InviteHeadline>{t(`slides.${slide}.headline`)}</InviteHeadline>
              <InviteBody>{t(`slides.${slide}.body`)}</InviteBody>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <Pressable
              key={slide}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1} / ${SLIDES.length}`}
              accessibilityState={{ selected: i === index }}
              hitSlop={Spacing.three}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: c.dotIdle },
                  i === index && styles.dotActive,
                ]}
              />
            </Pressable>
          ))}
        </View>

        <InviteActions>
          {/* Créer un compte d'ABORD : ici on accueille un inconnu. La porte
              d'identité inverse les deux — qui bute sur une porte a presque
              toujours un compte. */}
          <InvitePrimary
            label={t('createAccount')}
            onPressAction={() => router.push('/register')}
          />
          <InviteSecondary label={t('login')} onPressAction={() => router.push('/login')} />
          <InviteTertiary label={t('browse')} onPressAction={browse} />
        </InviteActions>
      </SafeAreaView>
    </View>
  );
}

/** La gouttière de l'écran. Elle n'est PAS sur `safeArea` : le carrousel doit
 *  pouvoir occuper toute la largeur, sinon la pagination s'arrête à côté de la
 *  page. Chaque bloc la reprend donc pour son compte — et c'est CELLE du
 *  modèle partagé, pas une constante locale qui dériverait de son côté. */
const GUTTER = InviteGutter;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  spacer: { flex: 1 },

  /* ── Le carrousel ─────────────────────────────────────────────────────── */
  // `flexGrow: 0` : sans lui, le ScrollView réclamerait la hauteur restante et
  // mangerait l'espaceur qui ancre tout le bloc en bas.
  pager: { flexGrow: 0 },
  /**
   * AUCUNE hauteur n'est écrite ici, et c'est le point délicat.
   *
   * Les volets n'ont pas le même nombre de lignes (trois pour « Plus vite. »,
   * deux pour « Ta valise »), et si chacun prend la sienne, les boutons
   * remontent d'un cran à chaque passage — exactement ce qu'on s'interdit.
   * Deux fausses pistes essayées avant celle-ci : une `minHeight` en dur
   * (206, juste pour le français d'aujourd'hui, fausse dès la traduction
   * suivante), puis un calage sur le bas (`justifyContent: 'flex-end'`) qui
   * collait le corps aux points et orphelinait le verrou de marque en haut.
   *
   * La bonne réponse était déjà dans le moteur : les volets sont les enfants
   * d'une RANGÉE, donc `alignItems: 'stretch'` (le défaut) leur donne à tous
   * la hauteur du PLUS GRAND. Il suffit de ne pas l'empêcher — l'ancien
   * `alignItems: 'flex-start'` sur le conteneur était la cause. La hauteur
   * s'adapte alors à la langue servie, sans constante à maintenir.
   */
  slide: {
    paddingHorizontal: GUTTER,
  },
  /* ── Les points ───────────────────────────────────────────────────────── */
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: GUTTER,
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  // Le volet courant est une barrette mango, pas un point plus clair : la
  // forme se distingue même pour un œil qui ne sépare pas les deux teintes.
  dotActive: {
    width: 20,
    backgroundColor: Brand.mango,
  },
});
