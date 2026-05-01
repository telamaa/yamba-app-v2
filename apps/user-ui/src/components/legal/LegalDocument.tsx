"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle } from "lucide-react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

type Props = {
  title: string;
  version: string;
  lastUpdated: string;
  content: string;
};

export default function LegalDocument({ title, version, lastUpdated, content }: Props) {
  const { lang } = useUiPreferences();
  const fr = lang === "fr";
  const isProduction = process.env.NEXT_PUBLIC_APP_ENV === "production";

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 lg:px-8 lg:py-16">
      {/* Header */}
      <header className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-4xl">
          {title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {fr ? "Version" : "Version"} : <strong>{version}</strong>
          </span>
          <span>
            {fr ? "Dernière mise à jour" : "Last updated"} : <strong>{lastUpdated}</strong>
          </span>
        </div>
      </header>

      {/* Bannière beta — masquée en production */}
      {!isProduction && (
        <div className="mb-8 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" size={18} />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {fr ? "Document en version bêta" : "Beta version"}
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              {fr
                ? "Ce document est une version provisoire qui doit être validée par un avocat avant la mise en production. Pour toute question : "
                : "This document is a draft and must be reviewed by a lawyer before going to production. For any inquiry: "}
              <a href="mailto:legal@yamba.com" className="font-semibold underline">
                legal@yamba.com
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Contenu Markdown */}
      <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-extrabold prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-8 prose-h3:text-base prose-a:text-[#0F766E] dark:prose-a:text-[#2DD4BF] prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900 dark:prose-strong:text-white">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </article>
  );
}
