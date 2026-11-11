import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { UserContent } from '@/components/user/user-content';
import { UserSkeleton } from '@/components/user/user-skeleton';

// User page (issue #62). The learner's own view: their profile and their own
// statistics about the content/knowledge they are learning. The full per-graph
// statistics dashboard is built in #61; this page hosts it. The Suspense
// boundary streams the skeleton while the Prisma queries are in flight.
export default async function UserPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('User');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
        <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
      </div>
      <Suspense fallback={<UserSkeleton />}>
        <UserContent />
      </Suspense>
    </div>
  );
}
