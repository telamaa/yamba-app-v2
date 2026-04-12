"use client";

import { ChevronRight } from "lucide-react";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {DashboardCopy} from "@/app/dashboard/dashboard.copy";


const HELP_ITEMS_FR = [
  { title: "Comment fonctionne Yamba ?", sub: "Guide de démarrage rapide" },
  { title: "Comment créer un trajet ?", sub: "Publier et gérer vos annonces" },
  { title: "Paiements et remboursements", sub: "Stripe, virements et litiges" },
  { title: "Contacter le support", sub: "support@yamba.app" },
];

const HELP_ITEMS_EN = [
  { title: "How does Yamba work?", sub: "Quick start guide" },
  { title: "How to create a trip?", sub: "Publish and manage your listings" },
  { title: "Payments and refunds", sub: "Stripe, transfers and disputes" },
  { title: "Contact support", sub: "support@yamba.app" },
];

export default function Help({ copy, isFr }: { copy: DashboardCopy; isFr: boolean }) {
  const items = isFr ? HELP_ITEMS_FR : HELP_ITEMS_EN;

  return (
    <>
      <SectionHeader title={copy.help.title} subtitle={copy.help.sub} />

      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          className="mb-1.5 flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
              {item.title}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {item.sub}
            </div>
          </div>
          <ChevronRight size={16} className="flex-shrink-0 text-slate-400" />
        </button>
      ))}
    </>
  );
}
