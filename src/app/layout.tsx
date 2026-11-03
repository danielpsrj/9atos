import type { Metadata } from 'next';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

export const metadata: Metadata = {
  title: '9Atos',
  description: 'Gamified spaced-repetition study app for legislation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // System font stack is applied globally in globals.css (plan §2.4); no
  // webfonts in V1. The [locale] segment and next-intl provider land in #30.
  // TooltipProvider is required by the tooltip primitive (issue #28).
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
