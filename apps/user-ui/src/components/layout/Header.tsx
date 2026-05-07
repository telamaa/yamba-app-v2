"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
import {
  HEADER_COMPACT_SCROLL_THRESHOLD,
  HEADER_Z_INDEX,
} from "./header/header.constants";

export default function Header() {
  const t = useTranslations("common.header");
  const userState = useHeaderUserState();
  const [isCompact, setIsCompact] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  useEffect(() => {
    const onScroll = () =>
      setIsCompact(window.scrollY > HEADER_COMPACT_SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const notificationCount = 16;
  const messageCount = 3;

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
        href: "/login",
        keywords: ["login", "connexion", "signin"],
      });
    }
    return base;
  }, [t, userState.isAuthenticated]);

  return (
    <>
      <div style={{ display: userState.isLoading ? "block" : "none" }}>
        <HeaderSkeleton isCompact={isCompact} />
      </div>

      <div style={{ display: userState.isLoading ? "none" : "block" }}>
        <CommandPalette actions={commandActions} />

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
                  href="/login"
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
          </div>
        </header>

        <HeaderMobileBottomSheet
          open={bottomSheetOpen}
          onCloseAction={() => setBottomSheetOpen(false)}
          user={userState}
          notificationCount={notificationCount}
          messageCount={messageCount}
        />
      </div>
    </>
  );
}
