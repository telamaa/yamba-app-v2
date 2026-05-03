// apps/user-ui/src/components/layout/HeaderSkeleton.tsx
"use client";

import { HEADER_Z_INDEX } from "./header/header.constants";

type Props = {
  isCompact?: boolean;
};

function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-200/90 dark:bg-slate-800/80 ${className}`}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10"
        style={{ animation: "yambaShimmer 1.6s infinite" }}
      />
    </div>
  );
}

/**
 * Skeleton du Header affiché pendant le chargement initial de l'auth.
 *
 * Reflète la nouvelle structure (cloche, bulle, avatar plus gros) pour éviter
 * un saut visuel quand `useUser` se résout. La hauteur (78px) est identique
 * à celle du vrai Header.
 */
export default function HeaderSkeleton({ isCompact = false }: Props) {
  return (
    <header
      className="fixed inset-x-0 top-0 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85"
      style={{ zIndex: HEADER_Z_INDEX }}
    >
      <div
        className={`mx-auto flex h-[78px] max-w-7xl items-center justify-between px-4 transition-all ${
          isCompact ? "py-2" : "py-3"
        }`}
      >
        {/* Left */}
        <div className="flex items-center gap-2 md:gap-3">
          <ShimmerBlock className="h-9 w-9 rounded-xl" />
          <div className="flex items-center gap-2">
            <ShimmerBlock className="h-7 w-24 rounded-md" />
            <ShimmerBlock className="hidden h-5 w-12 rounded-full md:block" />
          </div>
        </div>

        {/* Desktop right */}
        <div className="hidden items-center gap-3 md:flex">
          <ShimmerBlock className="h-7 w-16 rounded-full" />
          <ShimmerBlock className="h-10 w-10 rounded-xl" />
          <ShimmerBlock className="h-9 w-36 rounded-full" />
          <ShimmerBlock className="h-9 w-9 rounded-full" />
          <ShimmerBlock className="h-9 w-9 rounded-full" />
          <ShimmerBlock className="h-9 w-9 rounded-full" />
        </div>

        {/* Mobile right */}
        <div className="flex items-center gap-2 md:hidden">
          <ShimmerBlock className="h-7 w-7 rounded-full" />
          <ShimmerBlock className="h-7 w-7 rounded-full" />
          <ShimmerBlock className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </header>
  );
}
