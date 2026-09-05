"use client";

/**
 * BookingTrackingLinkCard.tsx — « Partage le suivi à {destinataire} » (D69 4A)
 * ============================================================================
 * L'Expéditeur demande le lien (POST /deals/:id/tracking-link, créé une fois) puis l'envoie
 * lui-même : WhatsApp vers le numéro qu'il a saisi, SMS natif, copie. Yamba n'envoie rien.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Link2, MessageCircle, MessageSquare } from "lucide-react";
import { track } from "@/lib/analytics";
import { issueTrackingLink } from "../booking-tracker.api";
import type { Booking } from "../booking-tracker.types";

export default function BookingTrackingLinkCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker.trackingLink");
  const [link, setLink] = useState<{ url: string; phone: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recipientFirstName = booking.recipient.firstName;

  async function ensureLink(): Promise<{ url: string; phone: string | null } | null> {
    if (link) return link;
    setBusy(true);
    setError(null);
    try {
      const r = await issueTrackingLink(booking.id);
      const next = { url: `${window.location.origin}${r.path}`, phone: r.recipientPhoneE164 };
      setLink(next);
      return next;
    } catch {
      setError(t("failed"));
      return null;
    } finally {
      setBusy(false);
    }
  }
  const message = (url: string) => t("messageTemplate", { recipientFirstName, carrierFirstName: booking.carrier.firstName, url });

  async function share(channel: "whatsapp" | "sms" | "copy") {
    const l = await ensureLink();
    if (!l) return;
    void track("tracking_link_shared", { bookingId: booking.id, channel });
    const body = message(l.url);
    if (channel === "whatsapp") {
      const target = l.phone ? l.phone.replace(/[^\d]/g, "") : "";
      window.open(`https://wa.me/${target}?text=${encodeURIComponent(body)}`, "_blank");
    } else if (channel === "sms") {
      window.location.href = `sms:${l.phone ?? ""}?&body=${encodeURIComponent(body)}`;
    } else {
      try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError(t("failed")); }
    }
  }

  const btn = "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800";
  return (
    <section className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-white"><Link2 size={15} className="text-[#0F766E]" />{t("title", { recipientFirstName })}</div>
      <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">{t("subtitle")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => share("whatsapp")} className={btn}><MessageCircle size={13} />{t("whatsapp")}</button>
        <button type="button" disabled={busy} onClick={() => share("sms")} className={btn}><MessageSquare size={13} />{t("sms")}</button>
        <button type="button" disabled={busy} onClick={() => share("copy")} className={btn}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? t("copied") : t("copy")}</button>
      </div>
      {link && <p className="mt-2 break-all text-[11.5px] text-slate-500">{link.url}</p>}
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
    </section>
  );
}
