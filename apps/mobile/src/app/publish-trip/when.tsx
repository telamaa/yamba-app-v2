/**
 * publish-trip/when.tsx — ③ QUAND PARS-TU ? (phase « Trajet »)
 * ========================================================
 * Quatre valeurs : deux dates, deux heures. Le site les met dans quatre
 * champs `<input type="date">` / `type="time"` côte à côte — c'est-à-dire
 * quatre sélecteurs du NAVIGATEUR, dont la capture du 21/11 montre bien
 * qu'ils ne sont ni à la charte ni dans la langue de l'interface
 * (« jj/mm/aaaa » sous une interface anglaise).
 *
 * Ici : les DATES se choisissent dans le calendrier maison (A207, celui de la
 * recherche — mois qui défilent, grille à la charte), les HEURES se TAPENT au
 * clavier numérique avec un masque (`masqueHeure`), parce qu'une heure de
 * départ se CONNAÎT et ne s'explore pas.
 *
 * Deux raccourcis portent la moitié des cas réels : « arrivée le jour même »
 * et « le lendemain ». Un vol intérieur et un trajet en voiture arrivent le
 * jour du départ ; un long-courrier de nuit arrive le lendemain. Ils posent
 * la date d'arrivée en un geste, et restent des raccourcis — le calendrier
 * reste ouvert à qui voyage trois jours.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { PublishStepFrame } from '@/components/publish/publish-step-frame';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import {
  dateDepartParDefaut,
  dateIso,
  heureParDefaut,
  manquesDeLEcran,
  masqueHeure,
  normaliseHeure,
} from '@/lib/publish-trip';
import { formatDayMonth } from '@/lib/trip-format';

export default function PublishWhenScreen() {
  const t = useTranslations('publish');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const draft = usePublishDraft();
  const [montreLesManques, setMontreLesManques] = useState(false);

  const manques = manquesDeLEcran(3, draft, new Date());

  /**
   * Les valeurs d'office, posées À L'OUVERTURE et jamais après : demain, la
   * prochaine heure pleine (les mêmes que le site). Elles ne remplacent
   * JAMAIS une saisie — la condition porte sur le vide, pas sur le montage,
   * sans quoi revenir en arrière effacerait ce qu'on vient d'écrire.
   *
   * Pourquoi d'office : un Voyageur publie pour un voyage proche, et une
   * date vide est une décision de plus à prendre pour rien. L'ARRIVÉE, elle,
   * reste vide — l'app ne sait pas si le vol dure deux heures ou douze, et
   * une date d'arrivée inventée serait une affirmation (D100).
   */
  useEffect(() => {
    const maintenant = new Date();
    const valeurs: { dateDepart?: string; heureDepart?: string } = {};
    if (draft.dateDepart === null) valeurs.dateDepart = dateDepartParDefaut(maintenant);
    if (draft.heureDepart === '') valeurs.heureDepart = heureParDefaut(maintenant);
    if (Object.keys(valeurs).length > 0) setPublishDraft(valeurs);
    // Au montage seulement : c'est une proposition d'ouverture, pas une règle
    // qui court pendant toute la vie de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onContinue = useCallback(() => {
    if (manques.length > 0) {
      setMontreLesManques(true);
      return;
    }
    setMontreLesManques(false);
    router.push('/publish-trip/price');
  }, [manques.length]);

  /** Un jour relatif au départ, posé en un geste. */
  const poserArrivee = useCallback(
    (joursApresLeDepart: number) => {
      if (draft.dateDepart === null) return;
      const jour = new Date(`${draft.dateDepart}T12:00:00`);
      jour.setDate(jour.getDate() + joursApresLeDepart);
      setPublishDraft({ dateArrivee: dateIso(jour) });
    },
    [draft.dateDepart]
  );

  const route =
    draft.depart !== null && draft.arrivee !== null
      ? t('bar.route', { from: draft.depart.ville, to: draft.arrivee.ville })
      : t('bar.newTrip');

  const memeJour = draft.dateArrivee !== null && draft.dateArrivee === draft.dateDepart;

  return (
    <PublishStepFrame
      title={t('when.title')}
      step={3}
      valueLabel={route}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('when.departureGroup')}
        </ThemedText>
        <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
          <LigneDate
            valeur={draft.dateDepart}
            label={t('when.dateRow')}
            nomComplet={t('when.departureDate')}
            onPressAction={() => router.push('/publish-trip/date?field=departure')}
          />
          <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />
          <LigneHeure
            label={t('when.timeRow')}
            nomComplet={t('when.departureTime')}
            valeur={draft.heureDepart}
            onChangeAction={(heureDepart) => setPublishDraft({ heureDepart })}
          />
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('when.arrivalGroup')}
        </ThemedText>
        <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
          <LigneDate
            valeur={draft.dateArrivee}
            label={t('when.dateRow')}
            nomComplet={t('when.arrivalDate')}
            onPressAction={() => router.push('/publish-trip/date?field=arrival')}
          />
          <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />
          <LigneHeure
            label={t('when.timeRow')}
            nomComplet={t('when.arrivalTime')}
            valeur={draft.heureArrivee}
            onChangeAction={(heureArrivee) => setPublishDraft({ heureArrivee })}
          />
        </View>
        {draft.dateDepart !== null ? (
          <View style={styles.chips}>
            <Raccourci
              label={t('when.sameDay')}
              choisi={memeJour}
              onPressAction={() => poserArrivee(0)}
            />
            <Raccourci
              label={t('when.nextDay')}
              choisi={draft.dateArrivee !== null && !memeJour && estLeLendemain(draft.dateDepart, draft.dateArrivee)}
              onPressAction={() => poserArrivee(1)}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.group}>
        <View style={styles.titreAvecMention}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('when.referenceTitle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('when.referenceOptional')}
          </ThemedText>
        </View>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          value={draft.reference}
          onChangeText={(reference) => setPublishDraft({ reference })}
          placeholder={t('when.referencePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={t('when.referenceTitle')}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t('when.referenceHint')}
        </ThemedText>
      </View>

      {montreLesManques && manques.length > 0 ? (
        <View style={styles.manques}>
          {manques.map((manque) => (
            <View key={manque} style={styles.manque}>
              <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
              <ThemedText type="small" style={{ color: Brand.mango }}>
                {t(`missing.${manque}`)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </PublishStepFrame>
  );

  function LigneDate({
    valeur,
    label,
    nomComplet,
    onPressAction,
  }: {
    valeur: string | null;
    /** Ce qui s'AFFICHE (« Date ») — le groupe au-dessus dit déjà « Départ ». */
    label: string;
    /** Ce qu'ANNONCE un lecteur d'écran, qui n'a pas le groupe sous les yeux. */
    nomComplet: string;
    onPressAction: () => void;
  }) {
    // « Samedi 28 novembre 2026 » sur une ligne de formulaire : quatre mots
    // pour une information qui en demande deux. L'année est celle en cours ou
    // la suivante — personne ne publie un vol pour 2029.
    const ecrit = valeur === null ? '' : formatDayMonth(new Date(`${valeur}T12:00:00`), locale);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${nomComplet} : ${ecrit === '' ? t('when.pickDate') : ecrit}`}
        onPress={onPressAction}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
          {label}
        </ThemedText>
        {ecrit === '' ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('when.pickDate')}
          </ThemedText>
        ) : (
          <ThemedText type="smallBold" numberOfLines={1}>
            {ecrit}
          </ThemedText>
        )}
        <Ionicons name="chevron-forward" size={16} color={theme.backgroundSelected} />
      </Pressable>
    );
  }

  function LigneHeure({
    label,
    nomComplet,
    valeur,
    onChangeAction,
  }: {
    label: string;
    nomComplet: string;
    valeur: string;
    onChangeAction: (heure: string) => void;
  }) {
    return (
      <View style={styles.row}>
        <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
          {label}
        </ThemedText>
        <TextInput
          style={[styles.heure, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          value={valeur}
          onChangeText={(saisie) => onChangeAction(masqueHeure(saisie))}
          onBlur={() => onChangeAction(normaliseHeure(valeur))}
          placeholder="--:--"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          maxLength={5}
          accessibilityLabel={nomComplet}
        />
      </View>
    );
  }

  function Raccourci({
    label,
    choisi,
    onPressAction,
  }: {
    label: string;
    choisi: boolean;
    onPressAction: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: choisi }}
        onPress={onPressAction}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: choisi ? Brand.mango : theme.backgroundElement,
            backgroundColor: choisi ? theme.backgroundElement : 'transparent',
            opacity: pressed ? 0.7 : 1,
          },
        ]}>
        <ThemedText type={choisi ? 'smallBold' : 'small'}>{label}</ThemedText>
      </Pressable>
    );
  }
}

/** « Le lendemain » se LIT sur les deux dates, il ne se mémorise pas : un
 *  état de plus serait un état de plus à garder cohérent. */
function estLeLendemain(depart: string, arrivee: string): boolean {
  const jour = new Date(`${depart}T12:00:00`);
  jour.setDate(jour.getDate() + 1);
  return dateIso(jour) === arrivee;
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 56,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  heure: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    minWidth: 88,
    minHeight: 44,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 24,
  },
  titreAvecMention: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    fontSize: 15,
  },
  manques: {
    gap: Spacing.one,
  },
  manque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
