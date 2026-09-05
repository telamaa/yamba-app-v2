/**
 * provider.ts — l'abstraction du fournisseur d'email (D35 2A)
 * ===========================================================
 * Sur le modèle du paiement (D38) : une interface, trois fournisseurs, une fabrique par
 * environnement qui REFUSE le faux en production. `resend` parle HTTP par `fetch` (zéro
 * dépendance) ; `smtp` garde Nodemailer (serveur d'entreprise, Mailpit en local) ; `fake`
 * journalise en mémoire pour le développement et les tests.
 */
import nodemailer, { type Transporter } from "nodemailer";

export type EmailProviderName = "RESEND" | "SMTP" | "FAKE";
export type OutgoingEmail = {
  to: string;
  from: string;
  subject: string;
  html: string;
  /** Étiquettes de rapprochement (jamais de donnée personnelle) : template, service. */
  tags?: Record<string, string>;
  /** Clé d'idempotence : un même envoi rejoué ne part pas deux fois (Resend). */
  idempotencyKey?: string;
};
export type SendResult = { provider: EmailProviderName; providerMessageId: string | null };

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(email: OutgoingEmail): Promise<SendResult>;
}

export class EmailSendError extends Error {
  constructor(message: string, public readonly status: number | null, public readonly retriable: boolean) {
    super(message);
    this.name = "EmailSendError";
  }
}

/* ── Resend ─────────────────────────────────────────────────────────────── */
export const RESEND_API_URL = "https://api.resend.com";
type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export class ResendEmailProvider implements EmailProvider {
  readonly name = "RESEND" as const;
  constructor(private readonly apiKey: string, private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init), private readonly baseUrl: string = RESEND_API_URL) {}
  /** Pur : la charge utile telle que Resend l'attend. */
  static payload(e: OutgoingEmail): Record<string, unknown> {
    return {
      from: e.from,
      to: [e.to],
      subject: e.subject,
      html: e.html,
      ...(e.tags ? { tags: Object.entries(e.tags).map(([name, value]) => ({ name, value: String(value).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) })) } : {}),
    };
  }
  async send(e: OutgoingEmail): Promise<SendResult> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
    if (e.idempotencyKey) headers["Idempotency-Key"] = e.idempotencyKey.slice(0, 256);
    const res = await this.fetchImpl(`${this.baseUrl}/emails`, { method: "POST", headers, body: JSON.stringify(ResendEmailProvider.payload(e)) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EmailSendError(`Resend ${res.status}: ${text.slice(0, 300)}`, res.status, res.status === 429 || res.status >= 500);
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { provider: "RESEND", providerMessageId: body.id ?? null };
  }
}

/* ── SMTP (Nodemailer) ──────────────────────────────────────────────────── */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "SMTP" as const;
  private transporter: Transporter | null = null;
  constructor(private readonly env: Record<string, string | undefined> = process.env) {}
  private transport(): Transporter {
    if (!this.transporter) {
      const port = Number(this.env.SMTP_PORT ?? 587);
      const auth = this.env.SMTP_USER ? { user: this.env.SMTP_USER, pass: this.env.SMTP_PASS } : undefined; // Mailpit : pas d'auth
      this.transporter = nodemailer.createTransport({ host: this.env.SMTP_HOST, port, secure: port === 465, ...(auth ? { auth } : {}) });
    }
    return this.transporter;
  }
  async send(e: OutgoingEmail): Promise<SendResult> {
    try {
      const info = (await this.transport().sendMail({ from: e.from, to: e.to, subject: e.subject, html: e.html })) as { messageId?: string };
      return { provider: "SMTP", providerMessageId: info?.messageId ?? null };
    } catch (err) {
      throw new EmailSendError(err instanceof Error ? err.message : String(err), null, true);
    }
  }
}

/* ── Fake (dev / tests) ─────────────────────────────────────────────────── */
export class FakeEmailProvider implements EmailProvider {
  readonly name = "FAKE" as const;
  readonly sent: Array<OutgoingEmail & { id: string; at: Date }> = [];
  constructor(private readonly log: (line: string) => void = (l) => console.info(l)) {}
  async send(e: OutgoingEmail): Promise<SendResult> {
    const id = `fake_${this.sent.length + 1}`;
    this.sent.push({ ...e, id, at: new Date() });
    this.log(`[email:fake] → ${e.to} « ${e.subject} » (${id})`);
    return { provider: "FAKE", providerMessageId: id };
  }
}

/* ── Fabrique ───────────────────────────────────────────────────────────── */
/** Pur : quel fournisseur pour cet environnement ? `EMAIL_PROVIDER` explicite, sinon déduit ; jamais FAKE en production. */
export function resolveEmailProviderName(env: Record<string, string | undefined>): EmailProviderName {
  const explicit = (env.EMAIL_PROVIDER ?? "").toUpperCase();
  const name: EmailProviderName = explicit === "RESEND" || explicit === "SMTP" || explicit === "FAKE" ? (explicit as EmailProviderName) : env.RESEND_API_KEY ? "RESEND" : env.SMTP_HOST ? "SMTP" : "FAKE";
  if (env.NODE_ENV === "production" && name === "FAKE") throw new Error("EMAIL_PROVIDER: the FAKE provider is refused in production (set RESEND_API_KEY or SMTP_HOST) — D35 2A");
  if (name === "RESEND" && !env.RESEND_API_KEY) throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY");
  if (name === "SMTP" && !env.SMTP_HOST) throw new Error("EMAIL_PROVIDER=smtp requires SMTP_HOST");
  return name;
}

export function createEmailProviderFromEnv(env: Record<string, string | undefined> = process.env): EmailProvider {
  const name = resolveEmailProviderName(env);
  if (name === "RESEND") return new ResendEmailProvider(env.RESEND_API_KEY as string);
  if (name === "SMTP") return new SmtpEmailProvider(env);
  return new FakeEmailProvider();
}
