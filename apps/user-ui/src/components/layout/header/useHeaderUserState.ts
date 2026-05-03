// apps/user-ui/src/components/layout/header/useHeaderUserState.ts
"use client";

import { useMemo } from "react";
import useUser from "@/hooks/useUser";
import { getUserInitials, formatDisplayName } from "@/lib/format-user";

export type CarrierState =
  | "none"          // Pas encore Yamber (peut publier mais pas encore activé)
  | "pending"       // Onboarding en cours (profil créé, Stripe non finalisé)
  | "active"        // Yamber actif (Stripe OK)
  | "verified";     // Super carrier (active + isSuperCarrier)

export type HeaderUserState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  initials: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  carrierState: CarrierState;
  /** True si on doit afficher un dot orange sur l'avatar (action en attente). */
  hasPendingAction: boolean;
};

/**
 * Hook dérivé : calcule l'état d'affichage utilisateur du Header.
 *
 * Centralise la logique de mapping entre les données brutes (`useUser`) et les
 * états visuels du Header (badge rôle, dot pending, checkmark vérifié).
 *
 * Source de vérité pour le statut Yamber :
 *   - active   = stripeOnboardingComplete && stripeChargesEnabled
 *   - pending  = onboardingStep !== "PROFILE" mais Stripe pas finalisé
 *   - verified = active && isSuperCarrier
 */
export default function useHeaderUserState(): HeaderUserState {
  const { user, isLoading } = useUser();

  return useMemo(() => {
    const isAuthenticated = Boolean(user);
    const initials = getUserInitials(user?.firstName, user?.lastName);
    const displayName = formatDisplayName(user?.firstName, user?.lastName);
    const email = user?.email ?? null;
    const avatarUrl = user?.avatar?.url ?? null;

    let carrierState: CarrierState = "none";
    let hasPendingAction = false;

    const cp = user?.carrierPage;
    if (cp) {
      const isStripeReady =
        Boolean(cp.stripeOnboardingComplete) && Boolean(cp.stripeChargesEnabled);

      if (isStripeReady) {
        // `isSuperCarrier` n'est pas (encore) renvoyé par /auth/me ; on retombe sur active.
        // Quand le champ sera exposé : carrierState = cp.isSuperCarrier ? "verified" : "active";
        carrierState = "active";
      } else if (cp.onboardingStep !== "PROFILE" || cp.stripeAccountId) {
        carrierState = "pending";
        hasPendingAction = true;
      }
    }

    return {
      isAuthenticated,
      isLoading,
      initials,
      displayName,
      email,
      avatarUrl,
      carrierState,
      hasPendingAction,
    };
  }, [user, isLoading]);
}
