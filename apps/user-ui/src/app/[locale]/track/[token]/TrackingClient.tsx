"use client";

/**
 * TrackingClient.tsx — la page que lit le destinataire (D69)
 * ===========================================================
 * Contenu minimal servi par GET /track/:token : jalons, prénoms, corridor, dates. Jamais
 * l'adresse, un numéro ni le code. 404 = lien retiré ou tiers effacé. Se termine par le bloc
 * d'acquisition (RGP-02 : la mention d'origine des données est affichée).
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Package, Plane, MapPin, Home, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";

type Milestone = "ACCEPTED" | "PICKED_UP" | "IN_TRANSIT" | "ARRIVED" | "DELIVERED" | "CLOSED";
type View = {
  milestone: Milestone;
  steps: { key: Milestone; at: string }[];
  recipientFirstName: string;
  shipperFirstName: string;
  carrier: { firstName: string; lastInitial: string };
  corridor: { originCity: string; destinationCity: string };
  departureAt: string | null;
  arrivalAt: string | null;
};
const ORDER: Milestone[] = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "DELIVERED"];
const ICON: Record<Milestone, typeof Check> = { ACCEPTED: Check, PICKED_UP: Package, IN_TRANSIT: Plane, ARRIVED: MapPin, DELIVERED: Home, CLOSED: XCircle };

export default function TrackingClient({ token }: { token: string }) {
  const t = useTranslations("tracking");
  const locale = useLocale();
  const [state, setState] = useState<{ view: View | null; status: "loading" | "ok" | "gone" }>({ view: null, status: "loading" });

  useEffect(() => {
    apiFetch<View>(`/track/${encodeURIComponent(token)}`)
      .then((view) => setState({ view, status: "ok" }))
      .catch(() => setState({ view: null, status: "gone" }));
  }, [token]);

  const fmt = (iso: string | null, withTime = false) => (iso ? new Intl.DateTimeFormat(locale, withTime ? { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" } : { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)) : "—");

  if (state.status === "loading") return <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-slate-500">…</div>;

  if (state.status === "gone" || !state.view) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("notFound.text")}</p>
        <Acquisition />
      </div>
    );
  }

  const v = state.view;
  const vars = { recipientFirstName: v.recipientFirstName, shipperFirstName: v.shipperFirstName, carrierFirstName: v.carrier.firstName, carrierInitial: v.carrier.lastInitial, originCity: v.corridor.originCity, destinationCity: v.corridor.destinationCity };
  const reached = new Map(v.steps.map((s) => [s.key, s.at]));
  const closed = v.milestone === "CLOSED";
  const CurrentIcon = ICON[v.milestone];

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("title", vars)}</h1>
      <p className="mt-2 text-[14px] text-slate-600 dark:text-slate-400">{t("subtitle", vars)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><div className="text-slate-500">{t("departure")}</div><div className="font-medium text-slate-900 dark:text-white">{fmt(v.departureAt)}</div></div>
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><div className="text-slate-500">{t("arrival")}</div><div className="font-medium text-slate-900 dark:text-white">{fmt(v.arrivalAt)}</div></div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">{t("current")}</div>
        <div className="mt-2 flex items-center gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-full ${closed ? "bg-slate-200 text-slate-600" : "bg-[#0F766E] text-white"}`}><CurrentIcon size={20} /></div>
          <div>
            <div className="text-[15px] font-semibold text-slate-900 dark:text-white">{t(`milestones.${v.milestone}`, vars)}</div>
            <div className="text-[12.5px] text-slate-600 dark:text-slate-400">{t(`hints.${v.milestone}`, vars)}</div>
          </div>
        </div>
        {!closed && (
          <ol className="mt-5 space-y-3">
            {ORDER.map((key) => {
              const at = reached.get(key);
              const Icon = ICON[key];
              return (
                <li key={key} className={`flex items-center gap-3 text-[13px] ${at ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full ${at ? "bg-[#0F766E]/10 text-[#0F766E]" : "bg-slate-100 dark:bg-slate-800"}`}><Icon size={14} /></span>
                  <span className="flex-1">{t(`milestones.${key}`, vars)}</span>
                  {at && <span className="text-[12px] text-slate-500">{fmt(at, true)}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p className="mt-5 text-[12px] text-slate-500 dark:text-slate-400">
        {t("privacy", vars)}{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2">{t("privacyLink")}</Link>
      </p>
      <Acquisition />
    </div>
  );
}

function Acquisition() {
  const t = useTranslations("tracking.acquisition");
  return (
    <section className="mt-10 rounded-2xl bg-[#FF9900]/10 p-5">
      <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">{t("title")}</h2>
      <p className="mt-1 text-[13px] text-slate-700 dark:text-slate-300">{t("text")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/search" className="rounded-full bg-[#FF9900] px-4 py-2 text-[13px] font-bold text-slate-950">{t("send")}</Link>
        <Link href="/become/carrier" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{t("carry")}</Link>
      </div>
    </section>
  );
}
