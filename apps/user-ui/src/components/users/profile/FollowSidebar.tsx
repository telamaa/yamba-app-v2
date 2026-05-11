"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  Heart,
  MessageCircle,
  Users,
  Flag,
  Settings,
  Sparkles,
} from "lucide-react";
import type { PublicUser } from "@/lib/public-user.types";
import {
  useFollowUser,
  useUnfollowUser,
  useUpdateFollowPreferences,
} from "@/hooks/useFollowMutations";

type Props = {
  user: PublicUser;
};

export default function FollowSidebar({ user }: Props) {
  const t = useTranslations("userProfile.sidebar");
  const router = useRouter();

  const { mutate: follow, isPending: isFollowing } = useFollowUser();
  const { mutate: unfollow, isPending: isUnfollowing } = useUnfollowUser();
  const { mutate: updatePrefs } = useUpdateFollowPreferences();

  const isPending = isFollowing || isUnfollowing;
  const isLoggedIn = user.follow.isFollowedByMe !== null;
  const isFollowed = user.follow.isFollowedByMe === true;

  const handleToggleFollow = () => {
    if (!isLoggedIn) {
      router.push(`/login?returnTo=/u/${user.publicSlug}`);
      return;
    }

    if (isFollowed) {
      unfollow(user.publicSlug);
    } else {
      follow({ slug: user.publicSlug, notifyNextTrip: true });
    }
  };

  const handleToggleNotify = (next: boolean) => {
    updatePrefs({ slug: user.publicSlug, notifyNextTrip: next });
  };

  const handleEditProfile = () => {
    router.push("/dashboard/profile");
  };

  const handleReport = () => {
    // TODO: ouvrir modal de signalement (PR future)
  };

  return (
    <div className="space-y-3">
      {/* ─── Card actions ─────────────────────────── */}
      <div
        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
        data-follow-cta
      >
        {user.isOwnProfile ? (
          <button
            type="button"
            onClick={handleEditProfile}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
          >
            <Settings size={13} />
            {t("editProfile")}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleToggleFollow}
              disabled={isPending}
              className={`mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                isFollowed
                  ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
                  : "bg-[#FF9900] text-slate-950 hover:bg-[#F08700]"
              }`}
            >
              <Heart
                size={13}
                className={isFollowed ? "fill-current" : ""}
                strokeWidth={2.5}
              />
              {isFollowed ? t("following") : t("follow")}
            </button>

            {/* Chat button — désactivé avec badge "Bientôt" */}
            <div className="relative">
              <button
                type="button"
                disabled
                className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
              >
                <MessageCircle size={13} />
                {t("chatWith", { firstName: user.firstName })}
              </button>
              <span className="absolute -right-1 -top-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
                <Sparkles size={8} />
                {t("comingSoon")}
              </span>
            </div>

            {isFollowed && (
              <NotifyToggle
                checked={user.follow.notifyNextTrip ?? false}
                onChange={handleToggleNotify}
              />
            )}
          </>
        )}
      </div>

      {/* ─── Card stats sociales (si applicable) ─── */}
      {(user.follow.followersCount > 0 || user.follow.followingCount > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="mb-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("network")}
          </p>
          <div className="space-y-1.5">
            {user.follow.followersCount > 0 && (
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <Users size={12} className="text-[#FF9900]" />
                <span className="font-bold">{user.follow.followersCount}</span>
                {t("followersLabel", {
                  count: user.follow.followersCount,
                })}
              </p>
            )}
            {user.follow.followingCount > 0 && (
              <p className="block text-xs text-slate-700 dark:text-slate-300">
                <span className="font-bold">{user.follow.followingCount}</span>{" "}
                {t("followingLabel", {
                  count: user.follow.followingCount,
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Lien Signaler ────────────────────────── */}
      {!user.isOwnProfile && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={handleReport}
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Flag size={12} />
            {t("reportProfile")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/*                       TOGGLE NOTIF                            */
/* ============================================================ */

function NotifyToggle({
                        checked,
                        onChange,
                      }: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTranslations("userProfile.sidebar");

  return (
    <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[#FF9900]" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            checked ? "right-0.5" : "left-0.5"
          }`}
        />
      </button>
      <div className="flex-1">
        <p className="text-[11px] font-semibold leading-tight text-slate-900 dark:text-white">
          {t("notifyNextTrip")}
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
          {t("notifyNextTripHint")}
        </p>
      </div>
    </label>
  );
}
