import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Themed 404 page (issue #29). Full localization lands with the [locale]
// segment in #30; for now it uses the default pt-BR strings and links home.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary p-8 text-center text-text-primary">
      <p className="text-2xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-md text-base text-text-secondary">
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
