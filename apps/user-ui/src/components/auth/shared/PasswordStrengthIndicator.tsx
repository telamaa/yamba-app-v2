"use client";

import { useEffect, useState } from "react";
import { Check, X, Shield } from "lucide-react";
import {
  getPasswordChecks,
  getPasswordLevel,
  getPasswordScore,
  type PasswordContext,
  type PasswordLevel,
} from "@/lib/auth/password-strength";

type Copy = {
  title: string;
  level: string;
  weak: string;
  medium: string;
  strong: string;
  excellent: string;
  close: string;
  criteria: {
    minLength: string;
    lowercase: string;
    uppercase: string;
    number: string;
    special: string;
    personalInfo: string;
    simpleDate: string;
    predictable: string;
  };
};

type Props = {
  password: string;
  context: PasswordContext;
  isFocused: boolean;
  copy: Copy;
  onCloseAction?: () => void;
};

const LEVEL_LABEL: Record<PasswordLevel, keyof Copy> = {
  empty: "weak",
  weak: "weak",
  medium: "medium",
  strong: "strong",
  excellent: "excellent",
};

const LEVEL_COLOR: Record<PasswordLevel, string> = {
  empty: "bg-slate-200 dark:bg-slate-800",
  weak: "bg-red-500",
  medium: "bg-amber-500",
  strong: "bg-emerald-500",
  excellent: "bg-emerald-600",
};

export default function PasswordStrengthIndicator({
                                                    password,
                                                    context,
                                                    isFocused,
                                                    copy,
                                                    onCloseAction,
                                                  }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  // Détecter mobile via media query
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Bloquer le scroll body quand bottom sheet ouvert sur mobile
  useEffect(() => {
    if (!(isMobile && isFocused && password.length > 0)) return undefined;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, isFocused, password.length]);

  if (password.length === 0) return null;

  const checks = getPasswordChecks(password, context);
  const score = getPasswordScore(checks);
  const level = getPasswordLevel(password, score);
  const levelLabel = copy[LEVEL_LABEL[level]] as string;

  const criteria = [
    { key: "minLength" as const, ok: checks.minLength, label: copy.criteria.minLength },
    { key: "lowercase" as const, ok: checks.lowercase, label: copy.criteria.lowercase },
    { key: "uppercase" as const, ok: checks.uppercase, label: copy.criteria.uppercase },
    { key: "number" as const, ok: checks.number, label: copy.criteria.number },
    { key: "special" as const, ok: checks.special, label: copy.criteria.special },
    { key: "personalInfo" as const, ok: checks.personalInfo, label: copy.criteria.personalInfo },
    { key: "simpleDate" as const, ok: checks.simpleDate, label: copy.criteria.simpleDate },
    { key: "predictable" as const, ok: checks.predictable, label: copy.criteria.predictable },
  ];

  // Strength bar inline (toujours visible si password non vide)
  const StrengthBar = (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((seg) => {
          const filled =
            (level === "weak" && seg <= 1) ||
            (level === "medium" && seg <= 2) ||
            (level === "strong" && seg <= 3) ||
            (level === "excellent" && seg <= 4);
          return (
            <div
              key={seg}
              className={`h-1 flex-1 rounded-full transition-colors ${
                filled ? LEVEL_COLOR[level] : "bg-slate-200 dark:bg-slate-800"
              }`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px]">
        <span className="text-slate-500 dark:text-slate-400">{copy.level}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">{levelLabel}</span>
      </div>
    </div>
  );

  // Panel de critères (utilisé en popover desktop ET en bottom sheet mobile)
  const CriteriaPanel = (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[#0F766E] dark:text-[#2DD4BF]" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">
            {copy.title}
          </span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            score >= 7
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : score >= 5
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
          }`}
        >
          {score}/8
        </span>
      </div>

      <ul className="space-y-2">
        {criteria.map((c) => (
          <li
            key={c.key}
            className={`flex items-start gap-2 text-xs transition-colors ${
              c.ok
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {c.ok ? (
              <Check size={13} className="mt-0.5 flex-shrink-0" strokeWidth={3} />
            ) : (
              <X size={13} className="mt-0.5 flex-shrink-0 opacity-40" strokeWidth={2.5} />
            )}
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  // Strength bar toujours visible dès que password non vide
  if (!isFocused && !isMobile) {
    return StrengthBar;
  }

  // Mobile : bottom sheet
  if (isMobile) {
    return (
      <>
        {StrengthBar}

        {isFocused && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
              onClick={onCloseAction}
              aria-hidden="true"
            />
            {/* Bottom sheet */}
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
              style={{
                animation: "slideUp 0.2s ease-out",
              }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
              {CriteriaPanel}
              <button
                type="button"
                onClick={onCloseAction}
                className="mt-4 w-full rounded-lg bg-[#FF9900] py-2.5 text-sm font-bold text-slate-900 hover:bg-[#F08700]"
              >
                {copy.close}
              </button>
            </div>
            <style jsx>{`
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>
          </>
        )}
      </>
    );
  }

  // Desktop : popover à droite
  return (
    <>
      {StrengthBar}
      {isFocused && (
        <div className="absolute left-[calc(100%+12px)] top-0 z-30 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 border-b border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
          {CriteriaPanel}
        </div>
      )}
    </>
  );
}
