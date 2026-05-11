"use client";

import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { usePublicUser } from "@/hooks/usePublicUser";
import { ApiError } from "@/lib/api";
import UserProfileView from "@/components/users/profile/UserProfileView";
import UserProfileSkeleton from "@/components/users/profile/UserProfileSkeleton";

type Props = {
  slug: string;
};

export default function UserProfileClient({ slug }: Props) {
  const { data: user, isLoading, isError, error } = usePublicUser(slug);

  if (isLoading) {
    return <UserProfileSkeleton />;
  }

  if (isError) {
    // 404 → page not-found Next.js
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    return <ErrorFallback />;
  }

  if (!user) return null;

  return <UserProfileView user={user} />;
}

function ErrorFallback() {
  const t = useTranslations("userProfile.error");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">
        <AlertCircle size={24} />
      </div>
      <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
        {t("title")}
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t("message")}
      </p>
    </div>
  );
}
