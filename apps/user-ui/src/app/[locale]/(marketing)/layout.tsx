import type { ReactNode } from "react";
import Footer from "@/components/layout/Footer";

/**
 * Marketing layout — pages avec footer.
 *
 * S'applique aux pages "marketing/contenu" :
 *  - / (home)
 *  - /how-it-works (futur)
 *  - /become-yamber (futur)
 *  - /help
 *  - /legal/*
 *  - /about, /contact, /blog (futurs)
 *
 * Pattern : sticky footer via flex-col. Le main occupe l'espace flexible,
 * le footer reste collé en bas même sur les pages courtes.
 *
 * Pas de <Header /> ici : il est déjà dans le layout parent (app/[locale]/layout.tsx).
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    // <div className="flex min-h-[calc(100vh-78px)] flex-col">
    //   <main className="flex-1">{children}</main>
    //   <Footer />
    // </div>
    <>
      <main className="min-h-[calc(100vh-78px)]">{children}</main>
      <Footer />
    </>
  );
}
