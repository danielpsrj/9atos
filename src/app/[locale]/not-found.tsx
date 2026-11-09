import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';

// Themed 404 page (issue #29, localized in #30). A server component rendered
// inside the [locale] layout, so it has locale context and reads the
// dictionary. Links home via next-intl's locale-aware Link. The "404" status
// code is universal (identical in every locale) and is not a translatable
// string, so it is rendered directly.
export default async function NotFound() {
  const t = await getTranslations('NotFound');
  const tc = await getTranslations('Common');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary p-8 text-center text-text-primary">
      <p className="text-2xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="max-w-md text-base text-text-secondary">{t('description')}</p>
      <Button asChild>
        <Link href="/">{tc('backHome')}</Link>
      </Button>
    </main>
  );
}
