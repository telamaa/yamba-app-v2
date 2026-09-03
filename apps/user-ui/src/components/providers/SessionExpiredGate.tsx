/**
 * SessionExpiredGate — « ta session a expiré » (A89)
 * ==================================================
 * Le client API émet `yamba:session-expired` quand un rafraîchissement de
 * session échoue sur une requête authentifiée (circuit breaker). Au lieu
 * d'un toast « Erreur, réessaye » par écran, UNE fenêtre de connexion
 * (AuthGateModal, A63) s'ouvre par-dessus la page ; après connexion, le
 * cache est invalidé et l'utilisateur refait son geste sur la page où il
 * était. Sur les pages publiques, la fenêtre reste fermée.
 */
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "@/i18n/navigation";
import { resetAuthRefreshCircuitBreaker } from "@/lib/api-client";
import AuthGateModal from "@/components/auth/shared/AuthGateModal";

export const SESSION_EXPIRED_EVENT = "yamba:session-expired";

export default function SessionExpiredGate() {
  const t = useTranslations("common.authGate.sessionExpired");
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onExpired = () => setOpen(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  return (
    <AuthGateModal
      open={open}
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
