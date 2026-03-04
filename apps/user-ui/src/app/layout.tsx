import "./global.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Header from "@/components/layout/Header";
import { Plus_Jakarta_Sans } from "next/font/google";
import { UiPreferencesProvider } from "@/components/providers/UiPreferencesProvider";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={plusJakarta.variable} suppressHydrationWarning>
    <body className="min-h-screen bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
    <ThemeProvider>
      <UiPreferencesProvider>
        <Header />
        <main>{children}</main>
      </UiPreferencesProvider>
    </ThemeProvider>
    </body>
    </html>
  );
}
