import "./global.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Header from "@/components/layout/Header";
import { Plus_Jakarta_Sans } from "next/font/google";
// import AppHeader from "@/components/layout/AppHeader";
import { UiPreferencesProvider } from "@/components/providers/UiPreferencesProvider";
import Providers from "@/app/providers";
import { Toaster } from "sonner";

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
      <ThemeProvider>
        <UiPreferencesProvider>
          <Header />
          <div className="pt-[78px]">
            <div className="mx-auto max-w-7xl px-4">
              {children}
            </div>
          </div>
        </UiPreferencesProvider>
      </ThemeProvider>
    </Providers>
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{ duration: 6000 }}
    />
    </body>
    </html>
  );
}
