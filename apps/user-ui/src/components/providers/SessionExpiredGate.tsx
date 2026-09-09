/**
 * SessionExpiredGate — « ta session a expiré » (A89)
 * ==================================================
 * Le client API émet `yamba:session-expired` quand un rafraîchissement de
 * session échoue sur une requête authentifiée (circuit breaker). Au lieu
 * d'un toast « Erreur, réessaye » par écran, UNE fenêtre de connexion
 * (AuthGateModal, A63) s'ouvre par-dessus la page ; après connexion, le
 * cache est invalidé et l'utilisateur refait son geste sur la page où il
 * était.
 *
 * ANO-WEB-01 (recette navigateur du 09/09/2026, cahier 01-WEB chapitre 5.3) — l'en-tête de ce
 * fichier affirmait « sur les pages publiques, la fenêtre reste fermée » : le code ne le
 * faisait pas. Sur `/login`, la fenêtre se posait donc sur l'écran de connexion et son fond
 * opaque BLOQUAIT le formulaire. Deux garde-fous, désormais : `api-client` ne signale une
 * expiration que si une session a existé (`session-marker`), et cet écran refuse de s'ouvrir
 * là où l'on vient précisément pour se connecter.
 */
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "@/i18n/navigation";
import { resetAuthRefreshCircuitBreaker } from "@/lib/api-client";
import AuthGateModal from "@/components/auth/shared/AuthGateModal";

export const SESSION_EXPIRED_EVENT = "yamba:session-expired";

/**
 * Les écrans où une fenêtre de connexion n'a aucun sens : on y est déjà venu pour s'occuper
 * de sa session. `usePathname` rend le chemin SANS le préfixe de langue.
 */
const ECRANS_DE_SESSION = [/^\/login/, /^\/register/, /^\/password/, /^\/refresh/];

export default function SessionExpiredGate() {
  const t = useTranslations("common.authGate.sessionExpired");
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const surUnEcranDeSession = ECRANS_DE_SESSION.some((r) => r.test(pathname || ""));

  useEffect(() => {
    const onExpired = () => setOpen(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Si l'on navigue VERS un écran de session pendant que la fenêtre est ouverte, elle se ferme :
  // sinon elle continuerait de recouvrir le formulaire de connexion.
  useEffect(() => {
    if (surUnEcranDeSession) setOpen(false);
  }, [surUnEcranDeSession]);

  return (
    <AuthGateModal
      open={open && !surUnEcranDeSession}
      onCloseAction={() => setOpen(false)}
      title={t("title")}
      subtitle={t("subtitle")}
      redirect={pathname || "/dashboard"}
      onSignedInAction={() => {
        resetAuthRefreshCircuitBreaker();
        void queryClient.invalidateQueries();
      }}
    />
  );
}
