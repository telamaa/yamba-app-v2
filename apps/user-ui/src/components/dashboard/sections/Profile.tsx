"use client";


import useUser from "@/hooks/useUser";
import {DashboardCopy} from "@/app/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {CardSection, SettingRow} from "@/components/dashboard/DashboardUI";


const MANGO = "#FF9900";

export default function Profile({ copy }: { copy: DashboardCopy }) {
  const { user } = useUser();
  const initial = user?.firstName?.charAt(0)?.toUpperCase() ?? "U";
  const name = user ? `${user.firstName} ${user.lastName}` : "—";
  const email = user?.email ?? "—";

  return (
    <>
      <SectionHeader title={copy.profile.title} subtitle={copy.profile.sub} />

      {/* Profile card */}
      <div className="mb-6 flex items-center gap-4 rounded-xl bg-white p-4 dark:bg-slate-950">
        <div
          className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full text-xl font-medium text-slate-900"
          style={{ backgroundColor: MANGO }}
        >
          {initial}
        </div>
        <div>
          <div className="text-base font-medium text-slate-900 dark:text-white">{name}</div>
          <div className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {email} {user?.phoneE164 ? `· ${user.phoneE164}` : ""}
          </div>
          <div className="mt-2 flex gap-1.5">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              {copy.emailVerified}
            </span>
            {user?.phoneE164 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                {copy.phoneVerified}
              </span>
            )}
          </div>
        </div>
      </div>

      <CardSection>
        <SettingRow label={copy.profile.title} description={name} actionLabel={copy.edit} />
        <SettingRow label="Date de naissance" description="—" actionLabel={copy.edit} />
        <SettingRow label="Adresse" description="—" actionLabel={copy.edit} />
      </CardSection>
    </>
  );
}
