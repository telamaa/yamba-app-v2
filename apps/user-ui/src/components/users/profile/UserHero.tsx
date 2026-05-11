"use client";

import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { MapPin, Calendar, ShieldCheck, Star } from "lucide-react";
import type { PublicUser } from "@/lib/public-user.types";
import { formatMemberSince, getInitials } from "@/lib/public-user.helpers";

type Props = {
  user: PublicUser;
};

export default function UserHero({ user }: Props) {
  const t = useTranslations("userProfile");
  const locale = useLocale() as "fr" | "en";

  const isCarrier = user.tripper !== null;
  const initials = getInitials(user.firstName, user.lastInitial);
  const memberSince = formatMemberSince(user.memberSince, locale);
  const bio = user.tripper?.bio ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_2px_8px_-2px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-4">
        {/* Avatar 72px */}
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border-2 border-[#FF9900] bg-orange-100 dark:bg-orange-500/20">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={`${user.firstName} ${user.lastInitial}.`}
              fill
              sizes="72px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-[#663d00] dark:text-[#FFB84D]">
              {initials}
            </div>
          )}
        </div>

        {/* Identité */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white lg:text-2xl">
              {user.firstName} {user.lastInitial}.
            </h1>

            {isCarrier && user.tripper?.badges.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300">
                <ShieldCheck size={11} strokeWidth={2.5} />
                {t("badges.verified")}
              </span>
            )}

            {isCarrier && user.tripper?.badges.isSuperCarrier && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
                <Star size={11} strokeWidth={2.5} />
                {t("badges.superTripper")}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {user.location.city && user.location.country && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} />
                {user.location.city}, {user.location.country}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} />
              {t("memberSince", { date: memberSince })}
            </span>
          </div>
        </div>
      </div>

      {/* Bio (compactée — moins de mt) */}
      {bio && (
        <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {bio}
        </p>
      )}
    </div>
  );
}
