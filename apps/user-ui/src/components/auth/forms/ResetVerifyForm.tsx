"use client";

/**
 * ResetVerifyForm.tsx — le code du mot de passe oublié (D97).
 * ===========================================================
 * **689 lignes devenues un appelant.** Cet écran était la SECONDE copie de
 * l'écran de vérification : ses propres six cases, son propre collage, ses
 * deux comptes à rebours, son propre verrou, sa propre pastille de sécurité,
 * et ses ~45 ternaires `fr ? … : …`. D92 avait refondu l'autre copie (celle
 * de l'inscription) sans que rien ne signale qu'il en existait une seconde.
 *
 * Tout cela vit désormais dans `OtpVerifyView`, une fois. Ne reste ici que ce
 * qui appartient VRAIMENT au parcours « mot de passe oublié » :
 *
 *  • l'adresse vient de `pwd_reset_email` (jamais de l'URL — ni logs, ni
 *    historique, ni referrer) ;
 *  • la phrase sous le titre ne dit PAS qu'un compte existe : « si un compte
 *    existe, un code a été envoyé à… » (anti-énumération, ANO-API-08 — le
 *    serveur répond toujours 200, l'écran ne doit pas le trahir) ;
 *  • le code vérifié rend un `passwordResetToken` (15 min) ;
 *  • « Modifier » retourne demander un code, sans fenêtre de confirmation :
 *    il n'y a rien à perdre ici, contrairement à l'inscription.
 *
 * **Défaut corrigé au passage** : l'ancienne version EFFAÇAIT `pwd_reset_email`
 * juste avant de pousser vers l'étape suivante — laquelle l'affiche (« Pour le
 * compte : »). L'écran suivant montrait donc un compte vide. L'adresse est
 * maintenant effacée par l'étape qui en a FINI avec elle.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import OtpVerifyView from "@/components/auth/shared/OtpVerifyView";
import { resendPasswordResetOtp, verifyPasswordResetOtp } from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";

type Props = {
  heroVisual: HeroVisual;
};

export default function ResetVerifyForm({ heroVisual }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations("auth.otp");
  const { toast } = useToast();

  const emailFromQuery = sp.get("email") ?? "";
  const [email, setEmail] = useState<string>("");
  /** Voir `RegisterVerifyForm` : le premier rendu ne sait pas encore. */
  const [lu, setLu] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const connue = emailFromQuery || sessionStorage.getItem("pwd_reset_email") || "";
    setEmail(connue);
    if (emailFromQuery) sessionStorage.setItem("pwd_reset_email", emailFromQuery);
    setLu(true);
  }, [emailFromQuery]);

  const onVerify = async (otp: string) => {
    const data = await verifyPasswordResetOtp({ email, otp });
    if (data?.passwordResetToken) {
      sessionStorage.setItem("pwd_reset_token", data.passwordResetToken);
    }
    // `pwd_reset_email` RESTE : l'étape suivante l'affiche, et c'est elle qui
    // l'efface une fois le mot de passe changé.
    router.push("/password/reset");
  };

  const onChangeEmail = () => {
    sessionStorage.removeItem("pwd_reset_email");
    sessionStorage.removeItem("pwd_reset_token");
    router.push("/password/forgot");
  };

  if (!lu) return null;

  return (
    <OtpVerifyView
      heroVisual={heroVisual}
      email={email}
      subtitle={t("sentToIfExists")}
      missingToken={email === ""}
      missingTokenMessage={t("missingTokenReset")}
      onVerifyAction={onVerify}
      onResendAction={async () => {
        await resendPasswordResetOtp({ email });
      }}
      onResentAction={() => toast({ type: "success", title: t("resentTitle"), message: t("resentMessage") })}
      onChangeEmailAction={onChangeEmail}
    />
  );
}
