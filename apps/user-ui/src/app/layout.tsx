import "./global.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Yamba",
  description: "Yamba description",
};

/**
 * Root layout — MUST contain <html> and <body> tags (Next.js 16 requirement).
 *
 * The <html lang="..."> attribute will be updated dynamically by the locale layout
 * when it's available, but we put a sensible default here.
 *
 * All providers and UI chrome are in app/[locale]/layout.tsx.
 */
export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={plusJakarta.variable} suppressHydrationWarning>
    <body className="min-h-screen bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
    {children}
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
