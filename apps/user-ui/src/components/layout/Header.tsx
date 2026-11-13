"use client";

import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { loginHrefFor } from "@/lib/auth/login-redirect";
import { tunnelModeFor } from "@/lib/layout/tunnel";
import CommandPalette, { type CommandAction } from "./CommandPalette";
import HeaderLogo from "./header/HeaderLogo";
import HeaderLocaleSwitcher from "./header/HeaderLocaleSwitcher";
import HeaderThemeToggle from "./header/HeaderThemeToggle";
import HeaderShareTripCTA from "./header/HeaderShareTripCTA";
import HeaderNotificationBell from "./header/HeaderNotificationBell";
import HeaderMessageBubble from "./header/HeaderMessageBubble";
import HeaderUserDropdown from "./header/HeaderUserDropdown";
import HeaderMobileTrigger from "./header/HeaderMobileTrigger";
import HeaderMobileBottomSheet from "./header/HeaderMobileBottomSheet";
import HeaderSkeleton from "./HeaderSkeleton";
import useHeaderUserState from "./header/useHeaderUserState";
import { useNotifications } from "@/hooks/useNotifications";
import { useConversations } from "@/hooks/useMessaging";
import {
  HEADER_COMPACT_SCROLL_THRESHOLD,
  HEADER_Z_INDEX,
} from "./header/header.constants";

export default function Header() {
  const t = useTranslations("common.header");
  const userState = useHeaderUserState();
  const pathname = usePathname();
  // A58 — « Connexion » ramène sur la page courante (hors pages auth et accueil).
  const loginHref = loginHrefFor(pathname);
  const [isCompact, setIsCompact] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  // ── Un tunnel n'offre pas la sortie (D93) ───────────────────────────────────
  // La cloche, la messagerie, le menu du compte, la palette Cmd+K et surtout le
  // CTA mangue « Partager un trajet » sont autant de portes de sortie — un appel
  // à l'action concurrent À L'INTÉRIEUR d'un entonnoir (revue UX 17/10, étendue
  // aux six pages d'auth le 13/11). Le régime vient de la ROUTE, pas d'ici :
  // `lib/layout/tunnel.ts` est pur et testé, et c'est la seule liste des pages
  // d'auth du dépôt. Ce qu'il RESTE diffère par tunnel :
  //   • paiement : le logo et la mention qui nomme Stripe ;
  //   • auth     : le logo, la langue et le thème — un sélecteur de langue ne
  //                quitte pas l'entonnoir, il le rend lisible, et qui atterrit
  //                sur /register depuis un lien d'e-mail n'a aucun autre moyen
  //                de changer de langue (le téléphone, lui, suit l'OS).
  // Le logo reste cliquable dans les deux : UNE sortie, neutre, toujours.
  const tunnel = tunnelModeFor(pathname);
  const isCheckoutTunnel = tunnel === "checkout";
  const isAuthTunnel = tunnel === "auth";
  const isTunnel = tunnel !== "none";

  useEffect(() => {
    const onScroll = () =>
      setIsCompact(window.scrollY > HEADER_COMPACT_SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // PR5 — la cloche dit la vérité : unreadCount du notification-service
  // (cache partagé avec la section Notifications, marquage lu compris).
  // enabled : jamais d'appel authentifié depuis une page publique.
  const { data: notificationsData } = useNotifications({
    enabled: userState.isAuthenticated,
  });
  const notificationCount = notificationsData?.unreadCount ?? 0;
  // Chantier F (D61) — la bulle dit la vérité : conversations avec messages non lus,
  // même cache que la messagerie du tableau de bord.
  const { data: conversationsData } = useConversations({ enabled: userState.isAuthenticated });
  const messageCount = conversationsData?.totalUnread ?? 0;

  const commandActions: CommandAction[] = useMemo(() => {
    const base: CommandAction[] = [
      {
        label: t("shareTrip"),
        href: "/trips/create",
        keywords: ["trip", "trajet", "partager"],
      },
      {
        label: t("help"),
        href: "/dashboard/help",
        keywords: ["support", "aide", "help"],
      },
    ];
    if (!userState.isAuthenticated) {
      base.unshift({
        label: t("login"),
        href: loginHref,
        keywords: ["login", "connexion", "signin"],
      });
    }
    return base;
  }, [t, userState.isAuthenticated, loginHref]);

  return (
    <>
      <div style={{ display: userState.isLoading ? "block" : "none" }}>
        <HeaderSkeleton isCompact={isCompact} tunnel={tunnel} />
      </div>

      <div style={{ display: userState.isLoading ? "none" : "block" }}>
        {!isTunnel && <CommandPalette actions={commandActions} />}

        <header
          className="fixed inset-x-0 top-0 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85"
          style={{ zIndex: HEADER_Z_INDEX }}
        >
          <div
            className={`mx-auto flex h-[78px] max-w-7xl items-center justify-between px-4 transition-all ${
              isCompact ? "py-2" : "py-3"
            }`}
          >
            <div className="hidden md:flex">
              <HeaderLogo compact={isCompact} mobile={false} />
            </div>
            <div className="flex md:hidden">
              <HeaderLogo compact={isCompact} mobile={true} />
            </div>

            {isCheckoutTunnel ? (
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                <Lock size={13} strokeWidth={2} />
                <span>{t("checkoutSecure")}</span>
              </div>
            ) : isAuthTunnel ? (
              /* Les deux réglages, à toutes les largeurs : ni l'un ni l'autre
                 ne fait sortir de l'entonnoir. */
              <div className="flex items-center gap-2 md:gap-3">
                <HeaderLocaleSwitcher variant="header" />
                <HeaderThemeToggle variant="icon" />
              </div>
            ) : (
            <>
            <div className="hidden items-center gap-3 md:flex">
              <HeaderLocaleSwitcher variant="header" />
              <HeaderThemeToggle variant="icon" />
              <HeaderShareTripCTA variant="desktop" />

              {userState.isAuthenticated ? (
                <>
                  <HeaderNotificationBell
                    count={notificationCount}
                    variant="desktop"
                  />
                  <HeaderMessageBubble
                    count={messageCount}
                    variant="desktop"
                  />
                  <HeaderUserDropdown
                    user={userState}
                    notificationCount={notificationCount}
                    messageCount={messageCount}
                  />
                </>
              ) : (
                <Link
                  href={loginHref}
                  className="text-sm font-medium text-slate-700 transition-colors hover:underline hover:underline-offset-4 dark:text-slate-200 dark:hover:text-white"
                >
                  {t("login")}
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 md:hidden">
              {userState.isAuthenticated ? (
                <>
                  <HeaderNotificationBell
                    count={notificationCount}
                    variant="mobile"
                  />
                  <HeaderMessageBubble
                    count={messageCount}
                    variant="mobile"
                  />
                  <HeaderMobileTrigger
                    user={userState}
                    onOpenAction={() => setBottomSheetOpen(true)}
                  />
                </>
              ) : (
                <>
                  <HeaderShareTripCTA variant="mobile" />
                  <HeaderMobileTrigger
                    user={userState}
                    onOpenAction={() => setBottomSheetOpen(true)}
                  />
                </>
              )}
            </div>
            </>
            )}
          </div>
        </header>

        {!isTunnel && (
        <HeaderMobileBottomSheet
          open={bottomSheetOpen}
          onCloseAction={() => setBottomSheetOpen(false)}
          user={userState}
          notificationCount={notificationCount}
          messageCount={messageCount}
        />
        )}
      </div>
    </>
  );
}
