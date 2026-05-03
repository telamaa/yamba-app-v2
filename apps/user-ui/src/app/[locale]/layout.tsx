import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Header from "@/components/layout/Header";
import { UiPreferencesProvider } from "@/components/providers/UiPreferencesProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { routing } from "@/i18n/routing";
import Providers from "@/app/[locale]/providers";

// Generate static params for all supported locales at build time
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Locale layout — wraps content with i18n providers + app chrome.
 *
 * Next.js 16 note:
 * - <html> and <body> tags are in the ROOT layout (app/layout.tsx).
 * - This layout only wraps children with providers and adds Header.
 *
 * Footer policy:
 * - Le Footer n'est PAS rendu ici (il polluerait les pages d'action user :
 *   search, dashboard, trips/create, auth, carrier onboarding, etc.).
 * - Il est rendu uniquement par le layout `(marketing)/layout.tsx` qui
 *   couvre les pages marketing/contenu : home, help, legal, about, etc.
 *
 * Layout guidelines:
 * - Le wrapper extérieur gère uniquement `pt-[78px]` pour réserver la place
 *   du Header fixed, sans imposer de container.
 * - Chaque page gère son propre container via <AppContainer> ou équivalent.
 */
export default async function LocaleLayout({
                                             children,
                                             params,
                                           }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <Providers>
        <ThemeProvider>
          <UiPreferencesProvider>
            <ToastProvider>
              <Header />
              <div className="pt-[78px]">{children}</div>
            </ToastProvider>
          </UiPreferencesProvider>
        </ThemeProvider>
      </Providers>
    </NextIntlClientProvider>
  );
}
