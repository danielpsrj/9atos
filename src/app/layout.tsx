import type { Metadata } from 'next';
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
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
