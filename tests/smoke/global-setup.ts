import { execSync } from 'node:child_process';
// The smoke-test harness runs in a plain Node context (not the Next.js app), so
// it instantiates its own PrismaClient against the ephemeral DB rather than
// importing the app's @/lib/prisma singleton.
// eslint-disable-next-line no-restricted-imports
import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';
import { tz } from '@date-fns/tz';

// Smoke-test global setup (issue #50, FR-04/05/06/12). Spins up the ephemeral
// Postgres (the db-test compose service), applies migrations, seeds the data,
// and — crucially for the streak-increment assertion — backdates the bootstrap
// user's ultimoAcesso to yesterday (America/Sao_Paulo) and sets ofensivaAtual
// to a known value (1). A fresh seed sets ultimoAcesso to today, so the first
// same-day sync would keep the streak at 0 (the lastActiveKey === todayKey
// branch); backdating to yesterday makes the sync compute gap === 1 and
// increment the streak (1 → 2). The ephemeral DB is wiped by global-teardown,
// so no per-test cleanup is needed.
const TEST_DB_URL = 'postgresql://postgres:secret@127.0.0.1:5433/9atos_test';
const EXAM_TIMEZONE = 'America/Sao_Paulo';

export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL = TEST_DB_URL;

  // Generate the Prisma client (the seed script imports PrismaClient; in CI
  // node_modules is fresh and the client is not yet generated).
  console.log('── generating Prisma client ──');
  execSync('npx prisma generate', { stdio: 'inherit' });

  console.log('── starting ephemeral test database (db-test) ──');
  execSync('docker compose --profile test up -d db-test', { stdio: 'inherit' });

  console.log('── waiting for postgres readiness ──');
  for (let i = 0; i < 30; i++) {
    try {
      execSync(
        'docker compose --profile test exec -T db-test pg_isready -U postgres -d 9atos_test',
        {
          stdio: 'ignore',
        },
      );
      console.log('postgres ready');
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log('── applying migrations to test database ──');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('── seeding test database ──');
  execSync('npx prisma db seed', { stdio: 'inherit' });

  console.log('── backdating the bootstrap user for the streak-increment test ──');
  const prisma = new PrismaClient();
  const saoPaulo = tz(EXAM_TIMEZONE);
  // Yesterday in Sao Paulo (the exam timezone), as a UTC instant.
  const yesterdaySaoPaulo = saoPaulo(subDays(new Date(), 1));
  await prisma.usuario.update({
    where: { id: 'usuario-bootstrap' },
    data: { ofensivaAtual: 1, maiorOfensiva: 1, ultimoAcesso: yesterdaySaoPaulo },
  });
  await prisma.$disconnect();
  console.log('── smoke-test database ready ──');
}
