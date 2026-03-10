// 1. A importação com o caminho correto apontando para o node_modules
import { PrismaClient as BusinessClient } from '@prisma/business-client';

const businessClients: Record<string, BusinessClient> = {};

export function getBusinessClient(businessDbName: string): BusinessClient {
  if (businessClients[businessDbName]) {
    return businessClients[businessDbName];
  }

  const baseDbUrl = process.env.DATABASE_BASE_URL; 
  const databaseUrl = `${baseDbUrl}/${businessDbName}?schema=public`;

  const client = new BusinessClient({
    datasources: {      
      businessdb: { url: databaseUrl },
    },
  });

  businessClients[businessDbName] = client;

  return client;
}