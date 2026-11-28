/**
 * conversation/[id].tsx — le fil (D117).
 * ========================================
 * Les EFFETS seulement : les règles vivent dans `lib/fil.ts`, jouables par
 * le harnais (A223). Cet écran lit, sonde, envoie — il ne décide rien.
 *
 * TROIS CHOSES QUE LE SERVEUR DÉCIDE ET QUE L'ÉCRAN AFFICHE :
 *   • `access.canWrite` ferme la saisie, et `access.reason` dit lequel des
 *     deux motifs s'applique — jamais un champ grisé que rien n'explique ;
 *   • `DELIVERY_CODE_IN_MESSAGE` est une RÈGLE (D43), pas une panne : on la
 *     dit en toutes lettres, et le texte RESTE dans la saisie ;
 *   • `flaggedContact` : le serveur a vu des coordonnées. On avertit
 *     l'AUTEUR sur sa propre bulle (D117 4A) — personne d'autre.
 *
 * LE SONDAGE S'ARRÊTE QUAND L'ÉCRAN N'EST PLUS REGARDÉ. `useFocusEffect`
 * couvre la navigation, `AppState` couvre le passage en arrière-plan : les
 * deux sont nécessaires, parce qu'une app réduite garde ses écrans montés
 * et continuerait à sonder dans la poche.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import { BackButton } from '@/components/back-button';
import { IdentityGate } from '@/components/identity-gate';
import { MeetupSheet } from '@/components/meetup-sheet';
import { MessageReportSheet } from '@/components/message-report-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTopInset } from '@/hooks/use-top-inset';
import { ApiError } from '@/lib/api/client';
import {
  accepterLeRendezVous,
  envoyerLeMessage,
  leFilDuDeal,
  marquerLu,
  reponsesRapides,
  revelerLeNumero,
} from '@/lib/api/messages.api';
import { useActivite } from '@/lib/activite-context';
import {
  MESSAGE_MAX,
  RYTHME_DU_FIL_MS,
  SEUIL_DU_COMPTEUR,
  avertirDesCoordonnees,
  cleDuRefus,
  corpsAEnvoyer,
  estDeMoi,
  filDeLApi,
  groupesParJour,
  jourDuMessage,
  manquesDuMessage,
  preavisDeFermeture,
  type FilComplet,
  type MessageDuFil,
} from '@/lib/fil';
import { intlTagFor } from '@/lib/number-format';
import {
  attendUneReponse,
  cleDuRefusDuNumero,
  cleDuRefusDuRendezVous,
  etatDuNumero,
  peutAccepter,
  type FenetreDuNumero,
  type RendezVous,
} from '@/lib/rendez-vous';

type ReponseRapide = { key: string; text: string };

function lesReponses(brut: unknown): ReponseRapide[] {
  const corps = typeof brut === 'object' && brut !== null ? (brut as { items?: unknown }) : {};
  if (!Array.isArray(corps.items)) return [];
  return corps.items
    .map((ligne) => {
      const r = typeof ligne === 'object' && ligne !== null ? (ligne as Record<string, unknown>) : {};
      const key = typeof r.key === 'string' ? r.key : '';
      const text = typeof r.text === 'string' ? r.text : '';
      return key.length > 0 && text.length > 0 ? { key, text } : null;
    })
    .filter((r): r is ReponseRapide => r !== null);
}

function FilContent() {
  /**
   * D124 — le paramètre de route est un **bookingId**, pas un identifiant de
   * conversation : un fil peut exister sans ligne en base, donc sans
   * identifiant. On l'ouvre par le deal, et le serveur matérialise la ligne à
   * ce moment-là. Les gestes d'ÉCRITURE (envoyer, marquer lu, accepter un
   * rendez-vous), eux, visent la conversation — dont l'identifiant arrive avec
   * la réponse, et seulement là.
   */
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('messaging');
  const theme = useTheme();
  const topInset = useTopInset();
  const tag = intlTagFor(useLocale());
  const { rafraichir } = useActivite();

  const [fil, setFil] = useState<FilComplet | null>(null);
  const [enEchec, setEnEchec] = useState(false);
  const [corps, setCorps] = useState('');
  const [envoiEnCours, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [reponses, setReponses] = useState<ReponseRapide[]>([]);
  const [aSignaler, setASignaler] = useState<MessageDuFil | null>(null);
  const [proposer, setProposer] = useState(false);
  const [gesteEnCours, setGeste] = useState(false);
  const [refusDuRdv, setRefusDuRdv] = useState<string | null>(null);

  /** L'identifiant de la CONVERSATION — connu seulement une fois le fil lu. */
  const conversationId = fil?.conversation.id ?? null;

  const liste = useRef<FlatList<GroupeAffiche> | null>(null);
  const dernierVu = useRef<string | null>(null);

  const relire = useCallback(async () => {
    if (bookingId === undefined) return;
    try {
      const lu = filDeLApi(await leFilDuDeal(bookingId));
      setFil(lu);
      setEnEchec(lu === null);
    } catch {
      // Une lecture qui échoue le DIT : sans cela, l'écran resterait un
      // squelette perpétuel — le défaut corrigé deux fois sur le site.
      setEnEchec(true);
    }
  }, [bookingId]);

  /* Le sondage : pendant qu'on REGARDE, et pas en arrière-plan (D117 7A). */
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      const battre = () => {
        if (vivant && AppState.currentState === 'active') void relire();
      };
      void relire();
      const minuterie = setInterval(battre, RYTHME_DU_FIL_MS);
      return () => {
        vivant = false;
        clearInterval(minuterie);
      };
    }, [relire])
  );

  /* Le catalogue des réponses rapides : une fois, il ne bouge pas. */
  useEffect(() => {
    let vivant = true;
    void reponsesRapides()
      .then((brut) => {
        if (vivant) setReponses(lesReponses(brut));
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  /* Marquer lu : à l'ouverture, puis à chaque NOUVEAU dernier message.
     Un échec ne se dit pas — le pire qu'il arrive est une pastille qui
     reste une minute de trop, et interrompre une lecture pour ça serait
     pire que le défaut. */
  const dernierId = fil?.messages[fil.messages.length - 1]?.id ?? null;
  useEffect(() => {
    if (conversationId === null || fil === null) return;
    if (dernierVu.current === dernierId) return;
    dernierVu.current = dernierId;
    void marquerLu(conversationId)
      .then(() => rafraichir())
      .catch(() => undefined);
  }, [conversationId, fil, dernierId, rafraichir]);

  const acces = fil?.conversation.acces ?? {
    peutLire: false,
    peutEcrire: false,
    motif: null,
    fermetureA: null,
  };
  const manques = manquesDuMessage({ corps, acces, envoiEnCours });

  const envoyer = useCallback(async () => {
    if (conversationId === null) return;
    const aEnvoyer = corpsAEnvoyer({ corps, acces, envoiEnCours });
    if (aEnvoyer === null) return;
    setEnvoi(true);
    setRefus(null);
    try {
      await envoyerLeMessage(conversationId, aEnvoyer);
      // Le texte ne quitte la saisie qu'une fois PARTI.
      setCorps('');
      await relire();
      void rafraichir();
    } catch (e) {
      // Un refus métier est une RÈGLE : on la dit, et on GARDE le texte —
      // le perdre ferait tout retaper (D116 1C, même famille).
      setRefus(t(`errors.${cleDuRefus(e instanceof ApiError ? e.code : null)}`));
    } finally {
      setEnvoi(false);
    }
  }, [conversationId, corps, acces, envoiEnCours, relire, rafraichir, t]);

  const accepter = useCallback(
    async (rdvId: string) => {
      if (conversationId === null || gesteEnCours) return;
      setGeste(true);
      setRefusDuRdv(null);
      try {
        await accepterLeRendezVous(conversationId, rdvId);
        await relire();
        void rafraichir();
      } catch (e) {
        setRefusDuRdv(
          t(
            `meetup.errors.${cleDuRefusDuRendezVous(
              e instanceof ApiError ? e.code : null,
              e instanceof ApiError ? e.details?.reason : null
            )}`
          )
        );
      } finally {
        setGeste(false);
      }
    },
    [conversationId, gesteEnCours, relire, rafraichir, t]
  );

  const ouvrirLeNumero = useCallback(async () => {
    if (conversationId === null || gesteEnCours) return;
    setGeste(true);
    setRefusDuRdv(null);
    try {
      // Geste IDEMPOTENT côté serveur : un second appui rend le même
      // numéro, pas une erreur. On relit plutôt que de poser le numéro
      // dans un état local — la vérité est dans le fil.
      await revelerLeNumero(conversationId);
      await relire();
    } catch (e) {
      setRefusDuRdv(
        t(`phone.errors.${cleDuRefusDuNumero(e instanceof ApiError ? e.code : null)}`)
      );
    } finally {
      setGeste(false);
    }
  }, [conversationId, gesteEnCours, relire, t]);

  if (enEchec)
    return (
      <EcranCourt
        titre={t('thread.loadError')}
        action={t('thread.back')}
        onPressAction={() => router.back()}
      />
    );

  if (fil === null)
    return (
      <ThemedView style={styles.centreTout}>
        <ActivityIndicator color={theme.textSecondary} />
      </ThemedView>
    );

  const conversation = fil.conversation;
  const groupes: GroupeAffiche[] = groupesParJour(fil.messages).map((groupe) => ({
    ...groupe,
    libelle: libelleDuJour(groupe.jour, tag, t),
  }));
  const preavis = preavisDeFermeture(acces.fermetureA, Date.now());
  const restants = MESSAGE_MAX - corps.length;
  const premierManque = manques[0];

  return (
    <ThemedView style={styles.plein}>
      <SafeAreaView style={styles.plein} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.plein}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* ── Le bandeau : qui, et sur quel trajet ─────────────── */}
          <View
            style={[
              styles.entete,
              { borderBottomColor: theme.backgroundElement, paddingTop: topInset + Spacing.two },
            ]}>
            <BackButton label={t('thread.back')} onPress={() => router.back()} />
            <View style={styles.enteteTexte}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {conversation.interlocuteur.prenom}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {conversation.corridor.depart} → {conversation.corridor.arrivee}
              </ThemedText>
            </View>
          </View>

          {/* ── Une porte qui va se fermer le dit AVANT ──────────── */}
          {preavis !== null ? (
            <View style={[styles.bandeau, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.bandeauTexte}>
                {t('notice.closing', { count: preavis })}
              </ThemedText>
            </View>
          ) : null}

          {/* ── Le rendez-vous : un OBJET, en tête du fil (D118 4A) ── */}
          <CarteDuRendezVous
            rdv={conversation.prochainRendezVous}
            monRole={conversation.monRole}
            prenom={conversation.interlocuteur.prenom}
            peutEcrire={acces.peutEcrire}
            occupe={gesteEnCours}
            numero={fil.numero}
            maintenantMs={Date.now()}
            tag={tag}
            refus={refusDuRdv}
            onProposerAction={() => setProposer(true)}
            onAccepterAction={(rdvId) => void accepter(rdvId)}
            onOuvrirLeNumeroAction={() => void ouvrirLeNumero()}
          />

          <FlatList
            ref={liste}
            data={groupes}
            keyExtractor={(groupe, index) => `${groupe.jour}-${index}`}
            contentContainerStyle={
              groupes.length === 0 ? styles.videCorps : styles.filCorps
            }
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => liste.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View style={styles.groupe}>
                {item.libelle.length > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.jour}>
                    {item.libelle}
                  </ThemedText>
                ) : null}
                {item.messages.map((message) => (
                  <Bulle
                    key={message.id}
                    message={message}
                    monRole={conversation.monRole}
                    tag={tag}
                    onSignalerAction={() => setASignaler(message)}
                  />
                ))}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.vide}>
                <ThemedText type="smallBold" style={styles.centreTexte}>
                  {t('thread.empty')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
                  {t('thread.emptyWhy')}
                </ThemedText>
              </View>
            }
          />

          {/* ── La saisie, ou la raison de son absence ───────────── */}
          {acces.peutEcrire ? (
            <View style={[styles.saisieBloc, { borderTopColor: theme.backgroundElement }]}>
              {reponses.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.reponses}>
                  {reponses.map((reponse) => (
                    <Pressable
                      key={reponse.key}
                      onPress={() => setCorps(reponse.text.slice(0, MESSAGE_MAX))}
                      accessibilityRole="button"
                      style={[styles.puce, { borderColor: theme.backgroundElement }]}>
                      <ThemedText type="small">{reponse.text}</ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              {refus !== null ? (
                <ThemedText type="small" style={styles.refus}>
                  {refus}
                </ThemedText>
              ) : null}

              <View style={styles.saisieRangee}>
                <TextInput
                  value={corps}
                  onChangeText={(texte) => setCorps(texte.slice(0, MESSAGE_MAX))}
                  placeholder={t('thread.placeholder')}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={[
                    styles.saisie,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                    },
                  ]}
                />
                <Pressable
                  onPress={() => void envoyer()}
                  accessibilityRole="button"
                  accessibilityLabel={t('thread.sendAccessibility')}
                  accessibilityState={{ busy: envoiEnCours }}
                  style={[
                    styles.envoyer,
                    { backgroundColor: premierManque === undefined ? Brand.mango : theme.backgroundElement },
                  ]}>
                  {envoiEnCours ? (
                    <ActivityIndicator size="small" color={theme.textSecondary} />
                  ) : (
                    <Ionicons
                      name="arrow-up"
                      size={18}
                      color={premierManque === undefined ? '#1A1A1A' : theme.textSecondary}
                    />
                  )}
                </Pressable>
              </View>

              {/* Le bouton ne reste jamais muet : il dit ce qui le retient
                  (A209), et le compteur n'apparaît qu'à l'approche. */}
              <ThemedText type="small" themeColor="textSecondary" style={styles.sousSaisie}>
                {premierManque?.quoi === 'trop-long'
                  ? t('missing.tropLong', { count: premierManque.dePlus })
                  : premierManque?.quoi === 'envoi'
                    ? t('missing.envoi')
                    : restants <= SEUIL_DU_COMPTEUR
                      ? t('thread.remaining', { count: restants })
                      : t('thread.codeWarning')}
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.ferme, { borderTopColor: theme.backgroundElement }]}>
              <Ionicons name="lock-closed-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.centreTexte}>
                {t(`closed.${acces.motif ?? 'autre'}`)}
              </ThemedText>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <MeetupSheet
        visible={proposer}
        conversationId={conversationId ?? ''}
        peutEcrire={acces.peutEcrire}
        onCloseAction={() => setProposer(false)}
        onProposeAction={() => {
          void relire();
          void rafraichir();
        }}
      />

      <MessageReportSheet
        visible={aSignaler !== null}
        conversationId={conversationId ?? ''}
        messageId={aSignaler?.id ?? ''}
        onCloseAction={() => setASignaler(null)}
      />
    </ThemedView>
  );
}


/**
 * CarteDuRendezVous — « où et quand », en tête du fil (D118 4A).
 *
 * Elle ne décide rien : `peutAccepter` et `attendUneReponse` disent qui
 * peut faire quoi (miroir de `canAcceptMeetup` côté serveur), et la porte
 * du numéro a QUATRE états dont aucun n'est un bouton mort — révélé,
 * ouvrable, trop tôt (on dit QUAND), sans ancre (on dit QUOI FAIRE).
 */
function CarteDuRendezVous({
  rdv,
  monRole,
  prenom,
  peutEcrire,
  occupe,
  numero,
  maintenantMs,
  tag,
  refus,
  onProposerAction,
  onAccepterAction,
  onOuvrirLeNumeroAction,
}: {
  rdv: RendezVous | null;
  monRole: 'SHIPPER' | 'CARRIER';
  prenom: string;
  peutEcrire: boolean;
  occupe: boolean;
  numero: FenetreDuNumero;
  maintenantMs: number;
  tag: string;
  refus: string | null;
  onProposerAction: () => void;
  onAccepterAction: (rdvId: string) => void;
  onOuvrirLeNumeroAction: () => void;
}) {
  const t = useTranslations('messaging');
  const theme = useTheme();

  const creneau =
    rdv === null
      ? ''
      : t('meetup.slot', {
          day: new Date(rdv.debutA).toLocaleDateString(tag, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          from: new Date(rdv.debutA).toLocaleTimeString(tag, {
            hour: '2-digit',
            minute: '2-digit',
          }),
          to: new Date(rdv.finA).toLocaleTimeString(tag, {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });

  const etat = etatDuNumero(numero, maintenantMs);

  return (
    <View style={[styles.carte, { borderBottomColor: theme.backgroundElement }]}>
      <View style={styles.carteTitre}>
        <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('meetup.title')}
        </ThemedText>
      </View>

      {rdv === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('meetup.noneWhy')}
        </ThemedText>
      ) : (
        <>
          <ThemedText type="smallBold">
            {t(rdv.genre === 'PICKUP' ? 'meetup.pickup' : 'meetup.delivery')} · {creneau}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {rdv.lieu}
            {rdv.detail === null ? '' : ` — ${rdv.detail}`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {rdv.statut === 'ACCEPTED'
              ? t('meetup.accepted')
              : attendUneReponse(rdv, monRole)
                ? t('meetup.waiting', { name: prenom })
                : t('meetup.toAccept')}
          </ThemedText>
        </>
      )}

      {refus !== null ? (
        <ThemedText type="small" style={styles.refus}>
          {refus}
        </ThemedText>
      ) : null}

      <View style={styles.carteGestes}>
        {peutAccepter(rdv, monRole, peutEcrire) && rdv !== null ? (
          <Pressable
            onPress={() => onAccepterAction(rdv.id)}
            accessibilityRole="button"
            accessibilityState={{ busy: occupe }}
            style={[styles.geste, { backgroundColor: Brand.mango }]}>
            <ThemedText type="small" style={styles.gesteMangue}>
              {t('meetup.accept')}
            </ThemedText>
          </Pressable>
        ) : null}

        {peutEcrire ? (
          <Pressable
            onPress={onProposerAction}
            accessibilityRole="button"
            style={[styles.geste, styles.gesteBorde, { borderColor: theme.backgroundElement }]}>
            <ThemedText type="small">
              {rdv === null ? t('meetup.propose') : t('meetup.counter')}
            </ThemedText>
          </Pressable>
        ) : null}

        {/* La porte du numéro : jamais un bouton mort. */}
        {etat === 'revele' && numero.numero !== null ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${numero.numero}`)}
            accessibilityRole="button"
            style={[styles.geste, styles.gesteBorde, { borderColor: theme.backgroundElement }]}>
            <Ionicons name="call-outline" size={13} color={theme.text} />
            <ThemedText type="small">{t('phone.call', { name: prenom })}</ThemedText>
          </Pressable>
        ) : etat === 'ouvrable' ? (
          <Pressable
            onPress={onOuvrirLeNumeroAction}
            accessibilityRole="button"
            accessibilityState={{ busy: occupe }}
            style={[styles.geste, styles.gesteBorde, { borderColor: theme.backgroundElement }]}>
            <Ionicons name="call-outline" size={13} color={theme.text} />
            <ThemedText type="small">{t('phone.reveal', { name: prenom })}</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* Les deux états FERMÉS disent pourquoi, et ce qui les ouvrira. */}
      {etat === 'trop-tot' && numero.ouvreA !== null ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.petit}>
          {t('phone.opensAt', {
            when: `${new Date(numero.ouvreA).toLocaleDateString(tag, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })} ${new Date(numero.ouvreA).toLocaleTimeString(tag, {
              hour: '2-digit',
              minute: '2-digit',
            })}`,
          })}
        </ThemedText>
      ) : etat === 'sans-ancre' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.petit}>
          {t('phone.needsMeetup')}
        </ThemedText>
      ) : null}
    </View>
  );
}

type GroupeAffiche = { jour: string; libelle: string; messages: MessageDuFil[] };

/**
 * Le libellé d'une journée, dans la langue du lecteur (D108).
 *
 * « Aujourd'hui » et « Hier » valent mieux qu'une date : ce sont les deux
 * seuls jours où l'on compte en jours plutôt qu'en dates.
 */
function libelleDuJour(
  jour: string,
  tag: string,
  t: (cle: string) => string
): string {
  if (jour.length === 0) return '';
  const maintenant = new Date();
  if (jour === jourDuMessage(maintenant.toISOString())) return t('thread.today');
  const hier = new Date(maintenant.getTime() - 86_400_000);
  if (jour === jourDuMessage(hier.toISOString())) return t('thread.yesterday');
  const [annee, mois, quantieme] = jour.split('-').map(Number);
  return new Date(annee, (mois ?? 1) - 1, quantieme).toLocaleDateString(tag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function Bulle({
  message,
  monRole,
  tag,
  onSignalerAction,
}: {
  message: MessageDuFil;
  monRole: 'SHIPPER' | 'CARRIER';
  tag: string;
  onSignalerAction: () => void;
}) {
  const t = useTranslations('messaging');
  const theme = useTheme();
  const mienne = estDeMoi(message, monRole);

  // Un message SYSTEM ou MEETUP se lit au CENTRE, en petit : il n'est de
  // personne. Sa clé est CALCULÉE — une clé absente ferait lire son chemin
  // au membre, d'où la fiche qui les épingle dans les deux dictionnaires.
  if (message.genre !== 'TEXT')
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.systeme}>
        {message.cleSysteme === null ? message.corps : t(`system.${message.cleSysteme}`)}
      </ThemedText>
    );

  const heure = new Date(message.creeA).toLocaleTimeString(tag, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.bulleRangee}>
      <View
        style={[
          styles.bulle,
          mienne
            ? { backgroundColor: Brand.mango, alignSelf: 'flex-end' }
            : { backgroundColor: theme.backgroundElement, alignSelf: 'flex-start' },
        ]}>
        <ThemedText type="small" style={mienne ? styles.texteMien : undefined}>
          {message.corps}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor={mienne ? undefined : 'textSecondary'}
          style={[styles.heure, mienne ? styles.heureMienne : undefined]}>
          {heure}
        </ThemedText>
      </View>

      {/* D117 4A — on avertit l'AUTEUR, et lui seul. */}
      {avertirDesCoordonnees(message, monRole) ? (
        <View style={styles.avertissement}>
          <Ionicons name="eye-outline" size={12} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.avertissementTexte}>
            {t('thread.contactWarning')}
          </ThemedText>
        </View>
      ) : null}

      {/* Le recours vit sur la bulle de l'AUTRE : un fil sans recours est
          un fil qu'on quitte. */}
      {!mienne ? (
        <Pressable
          onPress={onSignalerAction}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('report.action')}
          style={styles.signaler}>
          <Ionicons name="flag-outline" size={12} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function EcranCourt({
  titre,
  action,
  onPressAction,
}: {
  titre: string;
  action: string;
  onPressAction: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.centreTout}>
      <ThemedText type="smallBold" style={styles.centreTexte}>
        {titre}
      </ThemedText>
      <Pressable
        onPress={onPressAction}
        accessibilityRole="button"
        style={[styles.reessayer, { borderColor: theme.backgroundElement }]}>
        <ThemedText type="small">{action}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function ConversationScreen() {
  return (
    <IdentityGate destination="messages" onDismiss={() => router.back()}>
      <FilContent />
    </IdentityGate>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  centreTout: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  enteteTexte: { flex: 1 },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  bandeauTexte: { flex: 1 },
  filCorps: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  videCorps: { flexGrow: 1, justifyContent: 'center' },
  vide: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  centreTexte: { textAlign: 'center' },
  groupe: { gap: Spacing.two, marginBottom: Spacing.three },
  jour: { textAlign: 'center' },
  systeme: { textAlign: 'center' },
  bulleRangee: { gap: 2 },
  bulle: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  texteMien: { color: '#1A1A1A' },
  heure: { fontSize: 11, textAlign: 'right' },
  heureMienne: { color: 'rgba(26,26,26,0.7)' },
  avertissement: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
    alignSelf: 'flex-end',
    maxWidth: '82%',
  },
  avertissementTexte: { flex: 1, fontSize: 11 },
  signaler: { alignSelf: 'flex-start', paddingVertical: 2 },
  saisieBloc: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  reponses: { gap: Spacing.two, paddingRight: Spacing.four },
  puce: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
  },
  refus: { color: '#DC2626' },
  saisieRangee: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  saisie: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    fontFamily: Font.regular,
    fontSize: 15,
  },
  envoyer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sousSaisie: { fontSize: 11 },
  ferme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  carte: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  carteTitre: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  carteGestes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  geste: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
  },
  gesteBorde: { borderWidth: 1 },
  gesteMangue: { color: '#1A1A1A', fontFamily: Font.semibold },
  petit: { fontSize: 11 },
  reessayer: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
  },
});
