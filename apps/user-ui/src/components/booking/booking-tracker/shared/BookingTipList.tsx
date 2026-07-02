/**
 * BookingTipList.tsx
 * ==================
 * Bloc bleu pédagogique collapsible générique (titre + puces **bold**).
 * Le parent fournit les items déjà traduits → réutilisable pour tous
 * les statuts (picked-up, in-transit, delivered…).
 */

"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  items: string[];
  defaultCollapsed?: boolean;
};

export default function BookingTipList({
                                         title,
                                         items,
                                         defaultCollapsed = false,
                                       }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="rounded-xl bg-blue-50 px-4 py-3.5 dark:bg-blue-950/30 sm:rounded-2xl sm:px-5 sm:py-4">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 text-left"
      >
        <Lightbulb
          size={15}
          className="flex-shrink-0 text-blue-700 dark:text-blue-400"
          aria-hidden="true"
        />
        <span className="flex-1 text-[13px] font-semibold text-blue-900 dark:text-blue-200 sm:text-[14px]">
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-blue-700 transition-transform dark:text-blue-400 ${
            collapsed ? "-rotate-90" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {!collapsed && (
        <ul className="mt-3 space-y-1.5 sm:space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[12px] leading-relaxed text-blue-800 dark:text-blue-300 sm:text-[13px]"
            >
              <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-blue-700 dark:bg-blue-400" />
              <span>{parseBold(item)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-blue-900 dark:text-blue-200">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
