"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { UserX } from "lucide-react";

export default function UserNotFound() {
  const t = useTranslations("userProfile.notFound");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        <UserX size={24} />
      </div>
      <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
        {t("title")}
      </h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        {t("message")}
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-full bg-[#FF9900] px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-[#F08700]"
      >
        {t("goHome")}
      </Link>
    </div>
  );
}
