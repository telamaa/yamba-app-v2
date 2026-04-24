import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Header from "@/components/layout/Header";
import { UiPreferencesProvider } from "@/components/providers/UiPreferencesProvider";
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
 * - This layout only wraps children with providers and adds Header/container.
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
            <Header />
            <div className="pt-[78px]">
              <div className="mx-auto max-w-7xl px-4">{children}</div>
            </div>
          </UiPreferencesProvider>
        </ThemeProvider>
      </Providers>
    </NextIntlClientProvider>
  );
}
