import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StudySession } from '@/components/session/study-session';

// Study session route (issues #37–#43). A thin wrapper around the client
// StudySession, which reads ?cadernoId= and ?game= from the query string, starts
// the session via the API, and renders the session chrome + game + results. The
// Suspense boundary is required because StudySession uses useSearchParams()
// (Next.js static-rendering requirement); the fallback shows the localized
// "starting" message while it loads.
export default async function StudyPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Session');

  return (
    <Suspense
      fallback={<p className="py-16 text-center text-base text-text-secondary">{t('starting')}</p>}
    >
      <StudySession />
    </Suspense>
  );
}
