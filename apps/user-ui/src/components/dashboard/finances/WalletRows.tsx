/**
 * WalletRows.tsx — les lignes du portefeuille et des paiements (A83)
 * ==================================================================
 * Une ligne = un deal, un montant, un état traduit. Cliquable vers le deal
 * (Voyageur) ou le suivi de l'envoi (Expéditeur). Le front affiche ce que
 * le serveur a décidé — aucun total, aucune date n'est recalculé ici.
 */
"use client";

import { ArrowDownLeft, ArrowUpRight, Clock3, Lock, ShieldAlert, Wallet } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { WalletPaymentItem, WalletPayoutItem } from "./wallet.types";

export function formatCents(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency }).format(cents / 100);
}

type Tone = "teal" | "emerald" | "amber" | "slate" | "red";
const TONE: Record<Tone, string> = {
  teal: "bg-teal-50 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function Row({ href, icon: Icon, tone, title, sub, amount, muted = false }: {
  href: string;
  icon: typeof Wallet;
  tone: Tone;
  title: string;
  sub: string;
  amount: string;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
    >
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${TONE[tone]}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{sub}</span>
      </span>
      <span className={`flex-shrink-0 text-[14px] font-black tabular-nums ${muted ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>
        {amount}
      </span>
    </Link>
  );
}

const PAYOUT_TONE: Record<WalletPayoutItem["state"], { tone: Tone; icon: typeof Wallet }> = {
  UPCOMING: { tone: "teal", icon: Clock3 },
  PENDING: { tone: "teal", icon: Clock3 },
  BLOCKED: { tone: "amber", icon: ShieldAlert },
  FROZEN: { tone: "slate", icon: Lock },
  SENT: { tone: "emerald", icon: ArrowDownLeft },
  HELD: { tone: "slate", icon: Lock },
};

export function PayoutRow({ item }: { item: WalletPayoutItem }) {
  const t = useTranslations("finances");
  const locale = useLocale();
  const format = useFormatter();
  const name = item.counterpartFirstName ?? t("unknownName");
  const date = item.date ? format.dateTime(new Date(item.date), { day: "numeric", month: "short" }) : "";
  const { tone, icon } = PAYOUT_TONE[item.state];
  return (
    <Row
      href={`/carrier/deals/${item.bookingId}`}
      icon={icon}
      tone={tone}
      title={`${t(`wallet.kind.${item.kind}`, { name })} · ${item.corridor.originCity} → ${item.corridor.destinationCity}`}
      sub={t(`wallet.state.${item.state}`, { date })}
      amount={item.amountCents === null ? "—" : `+ ${formatCents(item.amountCents, item.currencyCode, locale)}`}
      muted={item.state !== "SENT"}
    />
  );
}

const PAYMENT_TONE: Record<WalletPaymentItem["state"], { tone: Tone; icon: typeof Wallet }> = {
  AUTHORIZED: { tone: "slate", icon: Clock3 },
  HELD: { tone: "amber", icon: Lock },
  RELEASED: { tone: "teal", icon: ArrowUpRight },
  RELEASED_NO_CHARGE: { tone: "slate", icon: ArrowDownLeft },
  REFUNDED: { tone: "emerald", icon: ArrowDownLeft },
  PARTIALLY_REFUNDED: { tone: "emerald", icon: ArrowDownLeft },
};

export function PaymentRow({ item }: { item: WalletPaymentItem }) {
  const t = useTranslations("finances");
  const locale = useLocale();
  const format = useFormatter();
  const route = `${item.corridor.originCity} → ${item.corridor.destinationCity}`;
  const date = item.date ? format.dateTime(new Date(item.date), { day: "numeric", month: "short" }) : "";
  const { tone, icon } = PAYMENT_TONE[item.state];
  const stateKey = item.state === "HELD" && item.bookingStatus === "DELIVERED" && item.date ? "HELD_UNTIL" : item.state;
  const sub = t(`payments.state.${stateKey}`, {
    date,
    amount: item.refundAmountCents !== null ? formatCents(item.refundAmountCents, item.currencyCode, locale) : "",
    retention: item.retentionCents !== null ? formatCents(item.retentionCents, item.currencyCode, locale) : "",
  });
  const isIn = item.state === "REFUNDED" || item.state === "PARTIALLY_REFUNDED";
  const shown = isIn && item.refundAmountCents !== null ? item.refundAmountCents : item.amountCents;
  return (
    <Row
      href={`/bookings/${item.bookingId}`}
      icon={icon}
      tone={tone}
      title={item.counterpartFirstName ? t("payments.line", { route, name: item.counterpartFirstName }) : t("payments.lineNoName", { route })}
      sub={sub}
      amount={`${isIn ? "+ " : "− "}${formatCents(shown, item.currencyCode, locale)}`}
      muted={item.state === "AUTHORIZED" || item.state === "RELEASED_NO_CHARGE"}
    />
  );
}
