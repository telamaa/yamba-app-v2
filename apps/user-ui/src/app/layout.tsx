import "./global.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Header from "@/components/layout/Header";
import { Plus_Jakarta_Sans } from "next/font/google";
// import AppHeader from "@/components/layout/AppHeader";
import { UiPreferencesProvider } from "@/components/providers/UiPreferencesProvider";
import Providers from "@/app/providers";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Yamba",
  description: "Yamba description"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={plusJakarta.variable} suppressHydrationWarning>
    <body className="min-h-screen bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Providers>
        {/*<style jsx global>{`*/}
        {/*      @keyframes yambaShimmer {*/}
        {/*        0% {*/}
        {/*          transform: translateX(-100%);*/}
        {/*        }*/}
        {/*        100% {*/}
        {/*          transform: translateX(100%);*/}
        {/*        }*/}
        {/*      }*/}
        {/*    `}</style>*/}
        <ThemeProvider>
          <UiPreferencesProvider>
            <Header />
            {/*<AppHeader />*/}
            <div className="pt-[78px]">
              {children}
            </div>

          </UiPreferencesProvider>
        </ThemeProvider>
      </Providers>
    </body>
    </html>
  );
}
