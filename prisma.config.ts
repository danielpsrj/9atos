import { defineConfig } from 'prisma/config';

// Plan §2.4: Prisma 6. Seed command runs the TypeScript seed script via tsx.
// The datasource URL still comes from the schema's `env("DATABASE_URL")`.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
