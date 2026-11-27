/**
 * deal/[id]/deliver.tsx — LA REMISE (D116).
 * ===========================================
 * Le geste qui clôt le transport : le destinataire dicte six chiffres, le
 * Voyageur les tape, l'argent part à J+4. Cela se joue dans une rue, un
 * hall, un parking — devant quelqu'un qui attend.
 *
 * LE CODE EST DICTÉ, PAS REÇU, et cela change le champ : aucun indice de
 * remplissage automatique (`autofill: false`). `oneTimeCode` proposerait au
 * Voyageur un code SMS reçu pour autre chose — une bonne pratique est un
 * pari sur un contexte, et le contexte est ici l'inverse de celui d'un code
 * d'authentification. Pas d'autofocus arraché non plus : on peut vouloir
 * photographier d'abord.
 *
 * LE SERVEUR COMPTE (A38) : `essaisRestants` et `verrouJusqua` viennent de
 * lui — de la vue Voyageur à l'ouverture, des `details` des 409 ensuite. Le
 * compte à rebours n'est qu'un AFFICHAGE : à son terme l'écran ne décide
 * rien, il repart d'un état neuf (le serveur a déjà remis le compteur à
 * zéro).
 *
 * LES PHOTOS SONT OPTIONNELLES (A76, deux au plus) et ne bloquent JAMAIS en
 * silence : le site fusionne `isSubmitting || !photosReady` et affiche
 * « Vérification… » pour toujours quand une photo échoue. Ici le bouton dit
 * ce qui le retient, et une photo en échec se réessaie d'une touche.
 *
 * LES JALONS sont un RÉCIT (A39), pas un formulaire : l'app n'offre que le
 * cran suivant, et ne rien cocher n'empêche pas de remettre.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BackButton } from '@/components/back-button';
import { CodeInput } from '@/components/code-input';
import { IdentityGate } from '@/components/identity-gate';
import { PhotoShelf } from '@/components/photo-shelf';
import { Action, Notice, Section } from '@/components/shipment/shipment-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePhotos } from '@/hooks/use-photos';
import { useTheme } from '@/hooks/use-theme';
import { useTopInset } from '@/hooks/use-top-inset';
import { ApiError } from '@/lib/api/client';
import {
  MauvaisRoleError,
  confirmerLeJalon,
  laDemande,
  remettre,
} from '@/lib/api/my-deals.api';
import { PHOTO_MAX_MB, uploadDeliveryPhoto } from '@/lib/api/upload.api';
import {
  JALONS,
  jalonEnvoyable,
  jalonSuivant,
  jalonsConfirmes,
  type Jalon,
} from '@/lib/jalons';
import { demandeDeLApi, peut, type DemandeDeLaListe } from '@/lib/mes-demandes';
import {
  PHOTOS_REMISE_MAX,
  SAISIE_NEUVE,
  apresLeRefus,
  compteARebours,
  corpsDeLaRemise,
  manquesDeLaRemise,
  resteDuVerrouMs,
  verrouExpire,
  versementDeLaReponse,
  type EtatDeLaSaisie,
} from '@/lib/remise';
import { formatDayMonth } from '@/lib/trip-format';

type Etat =
  | { phase: 'chargement' }
  | { phase: 'erreur'; mauvaisRole: boolean }
  | { phase: 'interdite' }
  | { phase: 'prete'; demande: DemandeDeLaListe };

function RemiseContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('deliver');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const topInset = useTopInset();
  const insets = useSafeAreaInsets();

  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });
  const [code, setCode] = useState('');
  const [saisie, setSaisie] = useState<EtatDeLaSaisie>(SAISIE_NEUVE);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [montrerLesManques, setMontrerLesManques] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [remis, setRemis] = useState<string | null>(null);
  const [jalonEnCours, setJalonEnCours] = useState<Jalon | null>(null);
  const [confirmes, setConfirmes] = useState<Jalon[]>([]);
  const [permissionRefusee, setPermissionRefusee] = useState<'camera' | 'photothèque' | null>(
    null
  );

  const { photos, choisir, retirer, reessayer } = usePhotos({
    max: PHOTOS_REMISE_MAX,
    televerser: uploadDeliveryPhoto,
    onRefus: (source) => setPermissionRefusee(source),
  });

  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void laDemande(id ?? '')
        .then((brut) => {
          if (!vivant) return;
          const demande = demandeDeLApi(brut);
          if (demande === null) {
            setEtat({ phase: 'erreur', mauvaisRole: false });
            return;
          }
          if (!peut(demande, 'deliver')) {
            setEtat({ phase: 'interdite' });
            return;
          }
          setEtat({ phase: 'prete', demande });
          // L'état de la saisie vient du SERVEUR, à chaque entrée sur
          // l'écran : un verrou posé il y a dix minutes doit se voir même si
          // l'app a été fermée entre-temps.
          setSaisie({
            essaisRestants: demande.essaisRestants,
            verrouJusqua: demande.verrouJusqua,
          });
          setConfirmes(jalonsConfirmes(demande.jalons));
        })
        .catch((e) => {
          if (vivant) setEtat({ phase: 'erreur', mauvaisRole: e instanceof MauvaisRoleError });
        });
      return () => {
        vivant = false;
      };
    }, [id])
  );

  /**
   * L'horloge ne tourne QUE pendant un verrou : une seconde qui s'écoule
   * sans rien à compter est un rendu par seconde pour rien, et sur un
   * téléphone cela se mesure en batterie.
   */
  const restantMs = resteDuVerrouMs(saisie, maintenant);
  useEffect(() => {
    if (restantMs <= 0) return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [restantMs]);

  // La fin du verrou n'est pas une permission, c'est un état neuf : le
  // serveur a déjà remis son compteur à zéro.
  useEffect(() => {
    if (saisie.verrouJusqua !== null && restantMs <= 0) {
      setSaisie(verrouExpire());
      setErreur(null);
    }
  }, [saisie.verrouJusqua, restantMs]);

  const formulaire = useMemo(
    () => ({ code, photos, etat: saisie, maintenantMs: maintenant }),
    [code, photos, saisie, maintenant]
  );
  const manques = manquesDeLaRemise(formulaire);

  const phraseDuManque = (): string | null => {
    const manque = manques[0];
    if (manque === undefined) return null;
    if (manque.quoi === 'verrou')
      return t('missing.locked', { countdown: compteARebours(manque.restantMs) });
    if (manque.quoi === 'code') return t('missing.code', { count: manque.chiffres });
    return t(`missing.${manque.quoi}`);
  };

  const envoyer = useCallback(async () => {
    const corps = corpsDeLaRemise(formulaire);
    // Pas de bouton désactivé (A209) : il dit ce qui le retient.
    if (corps === null) {
      setMontrerLesManques(true);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await remettre(id ?? '', corps);
      setRemis(versementDeLaReponse(reponse) ?? '');
    } catch (e) {
      if (!(e instanceof ApiError)) {
        // Le réseau n'est PAS un refus : rien n'est parti, et le geste se
        // refait tel quel. Le dire évite la question qui vient debout
        // devant le destinataire — « est-ce que c'est passé ? ».
        setErreur(t('networkFailed'));
        return;
      }
      // Le serveur est la SEULE source du compteur et du verrou.
      setSaisie((avant) => apresLeRefus(avant, { code: e.code, details: e.details }));
      setMaintenant(Date.now());
      setCode('');
      setErreur(messageDuRefus(e, t, etat));
      setMontrerLesManques(false);
    } finally {
      setEnvoi(false);
    }
  }, [formulaire, id, t, etat]);

  const marquerLeJalon = useCallback(
    async (jalon: Jalon) => {
      // La RÈGLE DU SERVEUR, relue à l'appui et pas seulement au rendu : le
      // cran a pu être confirmé entre les deux (double appui, relecture de
      // l'écran). Laisser partir le geste vaudrait un
      // `TRACKING_STEP_NOT_ALLOWED` que rien n'explique au Voyageur.
      if (!jalonEnvoyable(confirmes, jalon)) return;
      setJalonEnCours(jalon);
      setErreur(null);
      try {
        await confirmerLeJalon(id ?? '', jalon);
        setConfirmes((avant) => (avant.includes(jalon) ? avant : [...avant, jalon]));
      } catch {
        // Un jalon refusé n'empêche pas de remettre : on le dit, sans drame.
        setErreur(t('milestones.failed'));
      } finally {
        setJalonEnCours(null);
      }
    },
    [confirmes, id, t]
  );

  const entete = (
    <View
      style={[
        styles.entete,
        { borderBottomColor: theme.backgroundElement, paddingTop: topInset + Spacing.two },
      ]}>
      <BackButton label={t('back')} onPress={() => router.back()} />
      <ThemedText type="subtitle" style={styles.titre}>
        {t('title')}
      </ThemedText>
    </View>
  );

  const cadre = (contenu: React.ReactNode) => (
    <ThemedView style={styles.ecran}>
      <SafeAreaView style={styles.colonne} edges={['left', 'right']}>
        {entete}
        <View style={styles.centre}>{contenu}</View>
      </SafeAreaView>
    </ThemedView>
  );

  /* ── Issue : le colis est remis ───────────────────────────────────────── */
  if (remis !== null) {
    const quand =
      remis.length > 0 ? formatDayMonth(new Date(remis), locale) : null;
    return cadre(
      <>
        <Ionicons name="checkmark-circle-outline" size={44} color={theme.text} />
        <ThemedText type="subtitle" style={styles.centreTexte}>
          {t('doneTitle')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
          {/* Le délai de vérification est une règle SERVEUR : on affiche la
              date qu'il a servie, on ne la recalcule pas (c'est de l'argent). */}
          {quand === null ? t('doneBody') : t('doneBodyWithDate', { date: quand })}
        </ThemedText>
        <Action label={t('keep')} tone="primary" onPressAction={() => router.back()} />
      </>
    );
  }

  if (etat.phase === 'chargement') return cadre(<ActivityIndicator color={theme.text} />);

  if (etat.phase === 'erreur')
    return cadre(
      <>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
          {etat.mauvaisRole ? t('wrongRole') : t('loadError')}
        </ThemedText>
        <Action label={t('keep')} tone="neutral" onPressAction={() => router.back()} />
      </>
    );

  if (etat.phase === 'interdite')
    return cadre(
      <>
        <ThemedText type="subtitle" style={styles.centreTexte}>
          {t('notAllowedTitle')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
          {t('notAllowedBody')}
        </ThemedText>
        <Action label={t('keep')} tone="primary" onPressAction={() => router.back()} />
      </>
    );

  const { demande } = etat;
  const prenom = demande.destinataire.prenom;
  const telephone = demande.destinataire.telephone;
  const suivant = jalonSuivant(confirmes);
  const manque = montrerLesManques ? phraseDuManque() : null;
  const verrouille = restantMs > 0;

  return (
    <ThemedView style={styles.ecran}>
      <SafeAreaView style={styles.colonne} edges={['left', 'right']}>
        <KeyboardAvoidingView
          style={styles.remplit}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {entete}

          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            {/* ── Le code ───────────────────────────────────────────────── */}
            <Section title={t('codeTitle')}>
              <ThemedText type="small" themeColor="textSecondary">
                {/* Le prénom peut ne pas être servi : la phrase existe en DEUX
                    versions plutôt que de laisser un trou (« demande à  »). */}
                {prenom.length > 0 ? t('codeWhy', { name: prenom }) : t('codeWhyNoName')}
              </ThemedText>

              <View style={styles.cases}>
                <CodeInput
                  value={code}
                  onChangeAction={(chiffres) => {
                    setCode(chiffres);
                    setErreur(null);
                  }}
                  accessibilityLabel={t('codeLabel')}
                  palette={{
                    card: theme.backgroundElement,
                    border: theme.backgroundSelected,
                    digit: theme.text,
                  }}
                  // Le code est DICTÉ : aucun indice de remplissage.
                  autofill={false}
                  disabled={verrouille || envoi}
                />
              </View>

              {/* Les essais restants : ce que le SERVEUR annonce, jamais un
                  calcul local. Rien à dire quand il n'a rien dit. */}
              {!verrouille && saisie.essaisRestants !== null && saisie.essaisRestants > 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
                  {t('attemptsLeft', { count: saisie.essaisRestants })}
                </ThemedText>
              ) : null}

              {verrouille ? (
                <Notice icon="lock-closed-outline">
                  {t('lockedBody', { countdown: compteARebours(restantMs) })}
                </Notice>
              ) : null}

              {erreur !== null ? (
                <ThemedText type="small" style={[styles.erreur, styles.centreTexte]}>
                  {erreur}
                </ThemedText>
              ) : null}

              {/* L'issue quand le code ne vient pas : appeler. Elle n'apparaît
                  que si le serveur a servi un numéro (il ne l'ouvre qu'à
                  partir de la prise en charge — ANO-API-15). */}
              {telephone !== null ? (
                <Action
                  label={prenom.length > 0 ? t('callNamed', { name: prenom }) : t('call')}
                  tone="quiet"
                  icon="call-outline"
                  onPressAction={() => void Linking.openURL(`tel:${telephone}`)}
                />
              ) : null}
            </Section>

            {/* ── La photo, facultative ─────────────────────────────────── */}
            <Section title={t('photosTitle')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('photosWhy', { max: PHOTOS_REMISE_MAX })}
              </ThemedText>
              {permissionRefusee !== null ? (
                <Notice icon="alert-circle-outline">
                  {`${t(
                    permissionRefusee === 'camera'
                      ? 'permissionCameraTitle'
                      : 'permissionLibraryTitle'
                  )} — ${t(
                    permissionRefusee === 'camera'
                      ? 'permissionCameraBody'
                      : 'permissionLibraryBody'
                  )}`}
                </Notice>
              ) : null}
              <PhotoShelf
                photos={photos}
                max={PHOTOS_REMISE_MAX}
                textes={{
                  prendre: t('takePhoto'),
                  photothèque: t('fromLibrary'),
                  retirer: t('remove'),
                  reessayer: t('retry'),
                  echec: (code_) => t(`uploadErrors.${code_}`, { maxMb: PHOTO_MAX_MB }),
                }}
                onChoisirAction={(source) => {
                  setPermissionRefusee(null);
                  void choisir(source);
                }}
                onRetirerAction={retirer}
                onReessayerAction={reessayer}
              />
            </Section>

            {/* ── Les jalons : un récit, et il est facultatif ───────────── */}
            <Section title={t('milestones.title')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('milestones.why')}
              </ThemedText>
              {JALONS.map((jalon) => {
                const fait = confirmes.includes(jalon);
                return (
                  <View key={jalon} style={styles.jalon}>
                    <Ionicons
                      name={fait ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={fait ? theme.text : theme.textSecondary}
                    />
                    <ThemedText
                      type="small"
                      themeColor={fait ? 'text' : 'textSecondary'}
                      style={styles.remplit}>
                      {t(`milestones.steps.${jalon}`)}
                    </ThemedText>
                  </View>
                );
              })}
              {/* UN SEUL geste : le cran suivant. Le serveur refuse tout
                  saut (A39) — proposer trois cases inviterait un refus que
                  rien n'explique. */}
              {suivant !== null ? (
                <Action
                  label={t('milestones.confirm', { step: t(`milestones.steps.${suivant}`) })}
                  tone="neutral"
                  pending={jalonEnCours === suivant}
                  onPressAction={() => void marquerLeJalon(suivant)}
                />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('milestones.allDone')}
                </ThemedText>
              )}
            </Section>
          </ScrollView>

          <View
            style={[
              styles.barre,
              {
                borderTopColor: theme.backgroundElement,
                paddingBottom: insets.bottom + Spacing.two,
              },
            ]}>
            {manque !== null ? (
              <ThemedText type="small" style={styles.erreur}>
                {manque}
              </ThemedText>
            ) : null}
            <Action
              label={t('submit')}
              tone="primary"
              icon="checkmark-done-outline"
              pending={envoi}
              onPressAction={() => void envoyer()}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Le refus du serveur, dit avec ses mots.
 *
 * `DELIVERY_LOCKED` n'a pas de message ici : le bandeau de verrou le dit
 * déjà, avec son horizon. Deux phrases pour un seul fait font douter des
 * deux.
 */
function messageDuRefus(
  erreur: ApiError,
  t: (cle: string, valeurs?: Record<string, string | number>) => string,
  etat: Etat
): string | null {
  const prenom =
    etat.phase === 'prete' ? etat.demande.destinataire.prenom : '';
  switch (erreur.code) {
    case 'DELIVERY_LOCKED':
      return null;
    case 'DELIVERY_CODE_INVALID':
      return prenom.length > 0 ? t('wrongCodeNamed', { name: prenom }) : t('wrongCode');
    case 'DELIVERY_CODE_UNAVAILABLE':
      return t('codeUnavailable');
    case 'TRANSITION_NOT_ALLOWED':
      return t('dealChanged');
    default:
      return t('failed');
  }
}

export default function RemiseScreen() {
  return (
    <IdentityGate destination="activity" onDismiss={() => router.back()}>
      <RemiseContent />
    </IdentityGate>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  colonne: { flex: 1, maxWidth: MaxContentWidth },
  remplit: { flex: 1 },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titre: { fontSize: 20 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  centreTexte: { textAlign: 'center' },
  page: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.one,
  },
  cases: { paddingVertical: Spacing.three },
  jalon: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barre: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  erreur: { color: '#DC2626' },
});
