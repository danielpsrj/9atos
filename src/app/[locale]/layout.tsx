import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { locales } from '@/i18n';
import '../globals.css';

export const metadata: Metadata = {
  title: '9Atos',
  description: 'Gamified spaced-repetition study app for legislation.',
};

// Locale layout (issue #30, AD-07): the [locale] segment is the root layout.
// It sets the <html lang>, provides the next-intl messages to the client, and
// wraps the app in the TooltipProvider (required by the tooltip primitive).
export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!(locales as readonly string[]).includes(locale)) {
    notFound();
  }
  // Enable static rendering per locale.
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <TooltipProvider>
            {children}
            {/* Toast system (issue #48, NFR-07): mounted once at the root so any
                client component can fire toasts via the src/lib/toast helpers. */}
            <Toaster />
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
