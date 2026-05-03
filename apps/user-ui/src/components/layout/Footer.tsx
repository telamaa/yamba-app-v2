"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type FooterLink = {
  labelKey: string;
  href: string;
};

type SocialName = "instagram" | "x" | "facebook";

type SocialLink = {
  name: SocialName;
  href: string;
  enabled: boolean;
};

const FOOTER_DISCOVER_LINKS: FooterLink[] = [
  { labelKey: "howItWorks", href: "/how-it-works" },
  { labelKey: "becomeYamber", href: "/become-yamber" },
  { labelKey: "helpFaq", href: "/help" },
];

const FOOTER_COMPANY_LINKS: FooterLink[] = [
  { labelKey: "about", href: "/about" },
  { labelKey: "contact", href: "/contact" },
  { labelKey: "blog", href: "/blog" },
];

const FOOTER_LEGAL_LINKS: FooterLink[] = [
  { labelKey: "terms", href: "/legal/terms" },
  { labelKey: "privacy", href: "/legal/privacy" },
  { labelKey: "legalNotice", href: "/legal/notice" },
];

const SOCIAL_LINKS_ENABLED: boolean = true;

const FOOTER_SOCIAL_LINKS: SocialLink[] = [
  { name: "instagram", href: "https://instagram.com/yamba", enabled: SOCIAL_LINKS_ENABLED },
  { name: "x", href: "https://x.com/yamba", enabled: SOCIAL_LINKS_ENABLED },
  { name: "facebook", href: "https://facebook.com/yamba", enabled: SOCIAL_LINKS_ENABLED },
];

/* ─────────────────────────────────────────────────────────────────────── */
/* Footer racine — switch desktop/mobile                                   */
/* ─────────────────────────────────────────────────────────────────────── */

export default function Footer() {
  return (
    <footer className="bg-slate-50 dark:bg-slate-950/40">
      <div className="md:hidden">
        <FooterMobile />
      </div>
      <div className="hidden md:block">
        <FooterDesktop />
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Desktop                                                                 */
/* ─────────────────────────────────────────────────────────────────────── */

function FooterDesktop(): ReactNode {
  const t = useTranslations("common.footer");
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-7xl border-t border-slate-200 px-4 py-10 dark:border-slate-800/60">
      <div className="grid grid-cols-4 gap-8">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("tagline")}
          </p>
          <div className="mt-5 flex items-center gap-2.5">
            {FOOTER_SOCIAL_LINKS.map((social) => (
              <SocialIcon key={social.name} social={social} />
            ))}
          </div>
        </div>

        <FooterColumn
          title={t("sections.discover")}
          links={FOOTER_DISCOVER_LINKS}
          labelGroup="discover"
          align="center"
        />

        <FooterColumn
          title={t("sections.company")}
          links={FOOTER_COMPANY_LINKS}
          labelGroup="company"
          align="center"
        />

        <FooterColumn
          title={t("sections.legal")}
          links={FOOTER_LEGAL_LINKS}
          labelGroup="legal"
          align="end"
        />
      </div>

      <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800/60">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          © {year} Yamba. {t("rightsReserved")}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Mobile — natif, compact, app-like                                        */
/* ─────────────────────────────────────────────────────────────────────── */

function FooterMobile(): ReactNode {
  const t = useTranslations("common.footer");
  const year = new Date().getFullYear();

  return (
    <div className="border-t border-slate-200 px-5 py-7 dark:border-slate-800/60">
      {/* Brand block — centré, app-feel */}
      <div className="flex flex-col items-center text-center">
        <p className="max-w-xs text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
          {t("tagline")}
        </p>
        <div className="mt-4 flex items-center gap-3">
          {FOOTER_SOCIAL_LINKS.map((social) => (
            <SocialIcon key={social.name} social={social} />
          ))}
        </div>
      </div>

      {/* Liens en 2 colonnes : Discover + Company */}
      <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-200 pt-6 dark:border-slate-800/60">
        <FooterColumnMobile
          title={t("sections.discover")}
          links={FOOTER_DISCOVER_LINKS}
          labelGroup="discover"
        />
        <div className="text-right">
          <FooterColumnMobile
            title={t("sections.company")}
            links={FOOTER_COMPANY_LINKS}
            labelGroup="company"
          />
        </div>
      </div>

      {/* Légal — pleine largeur, séparé visuellement */}
      <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800/60">
        <FooterColumnMobile
          title={t("sections.legal")}
          links={FOOTER_LEGAL_LINKS}
          labelGroup="legal"
          inline
        />
      </div>

      {/* Copyright */}
      <p className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-500">
        © {year} Yamba. {t("rightsReserved")}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* FooterColumn (desktop)                                                  */
/* ─────────────────────────────────────────────────────────────────────── */

type FooterColumnProps = {
  title: string;
  links: FooterLink[];
  labelGroup: "discover" | "company" | "legal";
  align?: "start" | "center" | "end";
};

function FooterColumn({
                        title,
                        links,
                        labelGroup,
                        align = "start",
                      }: FooterColumnProps): ReactNode {
  const t = useTranslations("common.footer");

  const alignClass =
    align === "center"
      ? "lg:justify-self-center"
      : align === "end"
        ? "lg:justify-self-end"
        : "";

  return (
    <div className={alignClass}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-slate-700 transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4 dark:text-slate-300 dark:hover:text-white"
            >
              {t(`${labelGroup}.${link.labelKey}`)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* FooterColumnMobile — variantes plus denses                              */
/* ─────────────────────────────────────────────────────────────────────── */

type FooterColumnMobileProps = {
  title: string;
  links: FooterLink[];
  labelGroup: "discover" | "company" | "legal";
  /** Si true, affiche les liens en ligne séparés par des dots (utilisé pour Légal). */
  inline?: boolean;
};

function FooterColumnMobile({
                              title,
                              links,
                              labelGroup,
                              inline = false,
                            }: FooterColumnMobileProps): ReactNode {
  const t = useTranslations("common.footer");

  if (inline) {
    return (
      <div className="text-center">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {title}
        </h3>
        <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {links.map((link, i) => (
            <li key={link.href} className="flex items-center gap-3">
              <Link
                href={link.href}
                className="text-[13px] text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                {t(`${labelGroup}.${link.labelKey}`)}
              </Link>
              {i < links.length - 1 && (
                <span aria-hidden className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      <ul className="mt-2.5 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[13px] text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {t(`${labelGroup}.${link.labelKey}`)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* SocialIcon                                                              */
/* ─────────────────────────────────────────────────────────────────────── */

function isSocialEnabled(social: SocialLink): boolean {
  return Boolean(social.enabled);
}

function SocialIcon({ social }: { social: SocialLink }): ReactNode {
  const t = useTranslations("common.footer.social");
  const ariaLabel = t(social.name);
  const isClickable = isSocialEnabled(social);

  const baseClass =
    "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition-all duration-200 dark:border-slate-800";

  const stateClass = isClickable
    ? "cursor-pointer text-slate-500 hover:scale-110 hover:border-[#FF9900] hover:text-[#FF9900] dark:text-slate-400 dark:hover:border-[#FF9900] dark:hover:text-[#FF9900]"
    : "cursor-not-allowed text-slate-300 dark:text-slate-700";

  const className = baseClass + " " + stateClass;

  const handleClick = () => {
    if (!isClickable) return;
    window.open(social.href, "_blank", "noopener,noreferrer");
  };

  return (
    <span
      role={isClickable ? "link" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={ariaLabel}
      title={isClickable ? undefined : t("comingSoon")}
      className={className}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <SocialSvg name={social.name} />
    </span>
  );
}

function SocialSvg({ name }: { name: SocialName }): ReactNode {
  if (name === "instagram") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-4 w-4"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[14px] w-[14px]" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
