import { PrismaClient } from '@prisma/client';

// Plan §2.4 / task 1.2: single PrismaClient instance, cached on globalThis in
// development so Next.js hot reloads don't open a new connection each time.
// All data access imports this singleton — no other file instantiates PrismaClient.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
