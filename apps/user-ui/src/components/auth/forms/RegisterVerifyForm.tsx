"use client";

/**
 * RegisterVerifyForm.tsx — la vérification du code d'inscription (D92, réduit
 * à son parcours par D97).
 * ===========================================================================
 * Une SALLE D'ATTENTE, pas un formulaire : c'est le seul écran du produit où
 * l'utilisateur sort du site pour aller chercher un code dans sa boîte mail,
 * et doit vouloir revenir. Les sept décisions de D92 vivent **toujours** ici
 * — mais dans `OtpVerifyView`, partagé avec le parcours « mot de passe
 * oublié », qui en était une seconde copie jamais corrigée (D97) :
 *
 *  1A — la colonne de gauche répond à l'attente au lieu de vendre, et plus
 *       de badge de sécurité auto-décerné (D91 1A).
 *  2A — l'adresse EN CLAIR, avec « Modifier » à côté : on masque une adresse
 *       qu'on n'a PAS tapée, pas celle qu'on vient de saisir.
 *  4A — la sixième frappe valide d'office, le focus est dans la première
 *       case à l'arrivée.
 *  5A — les cases se voient (WCAG 2.1 SC 1.4.11 : 3:1 pour la limite d'un
 *       contrôle ; 1,32:1 mesuré avant).
 *  6A — un seul compte à rebours, et l'aide arrive quand elle sert.
 *  7A — les textes vivent sous `auth.otp`, dans les deux dictionnaires.
 *
 * Ne reste ici que **3A, la connexion enchaînée** — ce que ce parcours a de
 * singulier : le mot de passe est en mémoire de module, la vérification ouvre
 * donc la session dans la foulée, et le titre « Plus qu'une étape ! » devient
 * vrai. Plus l'annulation d'une inscription, qui demande confirmation parce
 * qu'elle DÉTRUIT quelque chose — là où le même geste, côté mot de passe
 * oublié, ne coûte rien.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import OtpVerifyView from "@/components/auth/shared/OtpVerifyView";
import {
  cancelRegistration,
  loginUser,
  resendRegistrationOtp,
  verifyRegistrationOtp,
} from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import { setFlashToast } from "@/lib/flash-toast";
import { REGISTER_REDIRECT_KEY, sanitizeRedirect, withRedirect } from "@/lib/auth/safe-redirect";
import { clearPendingPassword, readPendingPassword } from "@/lib/auth/register-flow-state";

type Props = {
  heroVisual: HeroVisual;
};

const CLE_JETON = "register_verification_token";
const CLE_EMAIL = "register_verification_email";

export default function RegisterVerifyForm({ heroVisual }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations("auth.otp");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tokenFromQuery = sp.get("token") ?? "";
  const emailFromQuery = sp.get("email") ?? "";

  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  /**
   * `sessionStorage` ne se lit qu'APRÈS le montage (rendu serveur oblige).
   * Sans ce drapeau, le premier rendu croirait le jeton absent et afficherait
   * « session expirée » une fraction de seconde à CHAQUE arrivée — le défaut
   * que l'ancien écran évitait en ne démarrant ses minuteries qu'au jeton.
   */
  const [lu, setLu] = useState(false);

  // Double repli : l'URL (liens envoyés par le serveur) ou la session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const jeton = tokenFromQuery || sessionStorage.getItem(CLE_JETON) || "";
    const adresse = emailFromQuery || sessionStorage.getItem(CLE_EMAIL) || "";
    setToken(jeton);
    setEmail(adresse);
    if (tokenFromQuery) sessionStorage.setItem(CLE_JETON, tokenFromQuery);
    if (emailFromQuery) sessionStorage.setItem(CLE_EMAIL, emailFromQuery);
    // Arrivée sans rien (URL tapée à la main, session expirée) : on repart
    // proprement de l'inscription plutôt que d'afficher six cases inutiles.
    if (!jeton && !adresse) router.push("/register");
    setLu(true);
  }, [tokenFromQuery, emailFromQuery, router]);

  /**
   * D92 3A — la connexion enchaînée. Un échec ici (réseau, mot de passe perdu
   * par un rechargement) retombe sur la connexion préremplie avec son bandeau
   * « compte activé » : jamais un compte activé bloqué sur un écran.
   */
  const finishAfterVerification = async () => {
    const verifiedEmail = emailFromQuery || sessionStorage.getItem(CLE_EMAIL) || email;
    const redirectTo = sanitizeRedirect(sessionStorage.getItem(REGISTER_REDIRECT_KEY));
    const password = readPendingPassword(verifiedEmail);

    sessionStorage.removeItem(CLE_JETON);
    sessionStorage.removeItem(CLE_EMAIL);
    sessionStorage.removeItem(REGISTER_REDIRECT_KEY);
    clearPendingPassword();

    if (password !== null) {
      try {
        // `rememberMe: false` — la valeur par défaut du formulaire de
        // connexion. L'enchaînement ne DÉCIDE pas à la place de l'utilisateur
        // d'une session longue qu'il n'a pas demandée.
        await loginUser({ email: verifiedEmail, password, rememberMe: false });
        await queryClient.invalidateQueries({ queryKey: ["user"] });
        router.push(redirectTo || "/");
        router.refresh();
        return;
      } catch {
        // on continue vers la connexion préremplie
      }
    }

    setFlashToast({ type: "success", message: t("verifiedFlash"), persistent: true });
    router.push(
      withRedirect(
        "/login?verified=1" + (verifiedEmail ? "&email=" + encodeURIComponent(verifiedEmail) : ""),
        redirectTo
      )
    );
    router.refresh();
  };

  const cancelMutation = useMutation({
    mutationFn: cancelRegistration,
    onSettled: () => {
      // Réussi ou non, on ne garde pas l'utilisateur prisonnier de l'écran.
      sessionStorage.removeItem(CLE_JETON);
      sessionStorage.removeItem(CLE_EMAIL);
      clearPendingPassword();
      router.push("/register");
    },
  });

  const onVerify = async (otp: string) => {
    await verifyRegistrationOtp({ verificationToken: token, otp });
    await finishAfterVerification();
  };

  const onResend = async () => {
    const data = await resendRegistrationOtp({ verificationToken: token });
    const nextToken = data?.verificationToken || token;
    sessionStorage.setItem(CLE_JETON, nextToken);
    setToken(nextToken);
  };

  const onChangeEmail = () => {
    // Ce geste DÉTRUIT une inscription en cours : il se confirme.
    if (!window.confirm(t("changeConfirm"))) return;
    clearPendingPassword();
    if (!token) {
      router.push("/register");
      return;
    }
    cancelMutation.mutate({ verificationToken: token });
  };

  if (!lu) return null;

  return (
    <OtpVerifyView
      heroVisual={heroVisual}
      email={email}
      subtitle={t("sentTo")}
      missingToken={token === ""}
      onVerifyAction={onVerify}
      onResendAction={onResend}
      onResentAction={() => toast({ type: "success", title: t("resentTitle"), message: t("resentMessage") })}
      onChangeEmailAction={onChangeEmail}
      changeEmailPending={cancelMutation.isPending}
    />
  );
}
