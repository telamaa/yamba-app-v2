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
 * Layout guidelines:
 * - The outer wrapper ONLY handles pt-[78px] to reserve space for the fixed Header.
 * - Each page is responsible for its own container (via AppContainer or direct
 *   max-w/px classes). This allows some pages to be full-width (e.g. hero sections)
 *   while others stay constrained.
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
              {/* pt-[78px] réserve la place du Header fixed, sans imposer de container.
                  Chaque page gère son container via <AppContainer> ou équivalent. */}
              <div className="pt-[78px]">{children}</div>
            </ToastProvider>
          </UiPreferencesProvider>
        </ThemeProvider>
      </Providers>
    </NextIntlClientProvider>
  );
}
