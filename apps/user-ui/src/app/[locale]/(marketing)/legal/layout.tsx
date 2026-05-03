import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-white dark:bg-slate-950">{children}</main>;
}
