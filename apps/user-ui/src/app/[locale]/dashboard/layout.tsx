"use client";

import React from "react";
import DashboardSidebar from "@/components/dashboard/desktop/DashboardSidebar";
import DashboardMobileNav from "@/components/dashboard/mobile/DashboardMobileNav";

export default function DashboardLayout({
                                          children,
                                        }: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto max-w-7xl px-1 py-8">
        <div className="flex gap-8">
          <div className="hidden shrink-0 md:block sticky top-8 h-[calc(100vh-4rem)] overflow-y-auto">
            <DashboardSidebar />
          </div>

          <main className="min-w-0 flex-1 rounded-2xl bg-slate-50 p-6 pb-24 dark:bg-slate-900 md:p-8 md:pb-8">
            {children}
          </main>
        </div>
      </div>

      <DashboardMobileNav />
    </>
  );
}
