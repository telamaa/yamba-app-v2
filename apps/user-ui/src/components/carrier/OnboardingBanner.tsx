/**
 * OnboardingBanner
 * ================
 * Persistent banner shown to users with carrierStatus === "ONBOARDING".
 * Displayed below the Header or at the top of the main content area.
 *
 * 📁 Place in: apps/user-ui/src/components/carrier/OnboardingBanner.tsx
 *
 * 🔌 Integration: Add to your layout or Header:
 *   import { OnboardingBanner } from "@/components/carrier/OnboardingBanner";
 *   // In your layout, after <Header />:
 *   <OnboardingBanner />
 */

"use client";

import React, { useState } from "react";
import { useUser } from "@/hooks/useUser";
import Link from "next/link";
import { X } from "lucide-react"; // or use your icon library

export function OnboardingBanner() {
  const { user, isLoading } = useUser();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if: loading, no user, not in ONBOARDING state, or dismissed
  if (isLoading || !user || user.carrierStatus !== "ONBOARDING" || dismissed) {
    return null;
  }

  return (
    <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Message */}
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 rounded-full bg-white/20 p-1.5">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </span>
            <p className="text-sm font-medium text-white">
              Ton profil Tripper n'est pas encore finalisé.{" "}
              <span className="hidden sm:inline">
                Termine ton inscription pour recevoir des propositions de transport.
              </span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/apps/user-ui/src/app/%5Blocale%5D/carrier/onboarding"
              className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-blue-600 shadow-sm transition-colors hover:bg-blue-50 dark:bg-white dark:text-blue-700 dark:hover:bg-gray-100"
            >
              Reprendre
              <svg
                className="ml-1.5 h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>

            {/* Dismiss button — only hides for this session */}
            <button
              onClick={() => setDismissed(true)}
              className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fermer la bannière"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
