"use client";
import React from "react";
import DashboardSidebar from "@/components/dashboard/desktop/DashboardSidebar";
import DashboardMobileNav from "@/components/dashboard/mobile/DashboardMobileNav";

/**
 * Layout dashboard — app-style plein viewport :
 * - hauteur fixe calc(100vh - 78px header), pas de scroll de page
 * - sidebar fixe (scrollable seulement si elle déborde)
 * - SEUL le contenu (main) scrolle, la card prend toute la hauteur
 * - pt aligné entre sidebar et padding interne du main (fini le décalage)
 */
export default function DashboardLayout({
                                          children,
                                        }: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto flex h-[calc(100vh-78px)] max-w-7xl gap-8 px-1 py-6">
        {/* Sidebar — top aligné sur le padding interne du main */}
        {/*<div className="hidden h-full shrink-0 overflow-y-auto pt-6 md:block md:pt-8">*/}
        <div className="hidden h-full shrink-0 overflow-y-auto md:block">
          <DashboardSidebar />
        </div>

        {/* Contenu — seule zone scrollable */}
        <main className="min-w-0 flex-1 overflow-y-auto rounded-2xl bg-slate-50 p-6 pb-24 dark:bg-slate-900 md:p-8 md:pb-8">
          {children}
        </main>
      </div>
      <DashboardMobileNav />
    </>
  );
}
