import { PrismaClient } from '@prisma/client';
import { log } from 'console';


declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

// eslint-disable-next-line turbo/no-undeclared-env-vars
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export async function connectDatabase() {
  try {
    await prisma.$connect();
    log('Database connected successfully');
  } catch (error) {
    log('Failed to connect to database:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  log('Database disconnected');
}