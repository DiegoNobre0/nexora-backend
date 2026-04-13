import { PrismaClient as PrismaBusinessClient } from '@prisma/business-client';

const businessClients: Record<string, PrismaBusinessClient> = {};

export function getBusinessClient(businessDbName: string): PrismaBusinessClient {
  if (businessClients[businessDbName]) {
    return businessClients[businessDbName];
  }

  const baseDbUrl = process.env.DATABASE_URL_BASE?.replace(/\/$/, '');

  if (!baseDbUrl) {
    throw new Error('DATABASE_URL_BASE não definida no .env');
  }

  const databaseUrl = `${baseDbUrl}/${businessDbName}?schema=public`;

  const client = new PrismaBusinessClient({
    datasources: {
      businessdb: { url: databaseUrl },
    },
  });

  businessClients[businessDbName] = client;
  return client;
}

// Tipo exportado para usar nos services como: import type { BusinessClient }
export type BusinessClient = ReturnType<typeof getBusinessClient>;