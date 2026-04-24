/**
 * useFlashToast.ts
 * =================
 * Reads a flash message from sessionStorage on mount and shows it via Sonner.
 * Supports persistent toasts that require explicit close.
 * Special handling for "onboarding_required" type with action buttons.
 *
 * 📁 Place in: apps/user-ui/src/hooks/useFlashToast.ts
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getFlashToast } from "@/lib/flash-toast";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

export type FlashType = "success" | "error" | "info" | "onboarding_required";

export function useFlashToast() {
  const router = useRouter();
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";

  useEffect(() => {
    const timer = setTimeout(() => {
      const flash = getFlashToast();
      if (!flash) return;

      const persistent = flash.persistent ?? flash.type === "onboarding_required";

      if (flash.type === "onboarding_required") {
        toast.info(flash.message, {
          duration: Infinity,
          closeButton: true,
          action: {
            label: isFr ? "Configurer maintenant" : "Configure now",
            onClick: () => router.push("/carrier/onboarding"),
          },
        });
        return;
      }

      const options = {
        duration: persistent ? Infinity : 6000,
        closeButton: true,
      };

      switch (flash.type) {
        case "success":
          toast.success(flash.message, options);
          break;
        case "error":
          toast.error(flash.message, options);
          break;
        case "info":
          toast.info(flash.message, options);
          break;
        default:
          toast(flash.message, options);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isFr, router]);
}
