"use client";

/**
 * SettingsSection.tsx — « Paramètres » : langue, thème, notifications (ANO-WEB-86, recette 5.26)
 * ==============================================================================================
 * L'écran était un reste de maquette : quatre lignes, un « Changer » sans gestionnaire et deux
 * bascules à `useState` local. Rien n'était enregistré, et l'état repartait à zéro au
 * rechargement — un membre pouvait croire avoir coupé ses emails.
 *
 * Chaque ligne porte maintenant le VRAI réglage, et chaque réglage vit là où il a un effet :
 *
 *   - « Langue » → la préférence du COMPTE (`PATCH /auth/me/locale`, D44 : c'est elle qui décide
 *     la langue des emails). On réutilise le sélecteur de l'en-tête, un seul geste dans le code ;
 *   - « Thème » → une préférence d'AFFICHAGE, sans effet serveur : next-themes, donc le
 *     navigateur (`localStorage`), avec le choix « Automatique » que le libellé annonçait déjà ;
 *   - « Notifications email » → `messagingReminderEmails` (D61), la seule préférence email qui
 *     existe côté serveur. Les emails transactionnels d'un Deal en cours ne se coupent pas : on
 *     le DIT, au lieu de proposer une bascule qui ne les couperait pas ;
 *   - « Notifications push » → rien n'est branché : la ligne informe, sans contrôle décoratif.
 *
 * Préférences email plus fines (par famille d'événement) et push : candidat au registre (D-next).
 */
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { CardSection, SettingRow, ToggleRow } from "@/components/dashboard/DashboardUI";
import HeaderLocaleSwitcher from "@/components/layout/header/HeaderLocaleSwitcher";
import useUser from "@/hooks/useUser";
import { updateMyPreferences } from "@/services/privacy.api";

/** Les trois choix de thème, dans l'ordre où ils s'affichent. */
const THEMES = ["system", "light", "dark"] as const;
type ChoixTheme = (typeof THEMES)[number];

export default function SettingsSection({ copy }: { copy: DashboardCopy }) {
  const { lang } = useUiPreferences();
  const { user } = useUser();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [monte, setMonte] = useState(false);
  const [relances, setRelances] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // next-themes ne connaît le thème qu'au montage (anti-flash) : avant, on n'affiche aucun choix
  // comme actif plutôt que d'en désigner un au hasard.
  useEffect(() => setMonte(true), []);

  useEffect(() => {
    const serveur = (user as { messagingReminderEmails?: boolean } | null | undefined)?.messagingReminderEmails;
    if (typeof serveur === "boolean") setRelances(serveur);
  }, [user]);

  /** La bascule n'affiche que ce qui est ENREGISTRÉ : en cas d'échec, elle revient et le dit. */
  async function basculerRelances(suivant: boolean) {
    setRelances(suivant);
    setErreur(null);
    try {
      await updateMyPreferences({ messagingReminderEmails: suivant });
      qc.invalidateQueries({ queryKey: ["user"] });
    } catch {
      setRelances(!suivant);
      setErreur(copy.emailNotifError);
    }
  }

  const choixActif: ChoixTheme | null = monte ? ((THEMES as readonly string[]).includes(theme ?? "") ? (theme as ChoixTheme) : "system") : null;
  const libelleTheme: Record<ChoixTheme, string> = {
    system: copy.themeAuto,
    light: copy.themeLight,
    dark: copy.themeDark,
  };

  return (
    <>
      <SectionHeader title={copy.settings.title} subtitle={copy.settings.sub} />

      <CardSection>
        <SettingRow
          label={copy.language}
          description={lang === "fr" ? "Français" : "English"}
          control={<HeaderLocaleSwitcher variant="inline" />}
        />
        <SettingRow
          label={copy.theme}
          description={choixActif === "system" || choixActif === null ? copy.themeAutoSub : libelleTheme[choixActif]}
          control={
            <div className="flex rounded-full bg-slate-100 p-0.5 dark:bg-slate-900">
              {THEMES.map((choix) => (
                <button
                  key={choix}
                  type="button"
                  aria-pressed={choixActif === choix}
                  onClick={() => setTheme(choix)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    choixActif === choix
                      ? "bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-900"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {libelleTheme[choix]}
                </button>
              ))}
            </div>
          }
        />
        <ToggleRow
          label={copy.emailNotif}
          description={copy.emailNotifSub}
          checked={relances}
          onChangeAction={basculerRelances}
        />
        {erreur && <p className="pb-2 text-xs text-red-600 dark:text-red-400">{erreur}</p>}
        {/* Aucun contrôle : le push n'est pas branché, et une bascule inerte serait un mensonge. */}
        <SettingRow label={copy.pushNotif} description={copy.pushNotifSub} />
      </CardSection>
    </>
  );
}
