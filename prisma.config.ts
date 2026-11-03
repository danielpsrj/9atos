import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Plan §2.4: Prisma 6. With a prisma.config.ts present, the CLI no longer
// auto-loads .env, so we load it explicitly here. The datasource URL still
// comes from the schema's `env("DATABASE_URL")`. Seed runs via tsx.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
