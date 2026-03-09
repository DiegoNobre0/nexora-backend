import { PrismaClient } from '@prisma/client';

// Um objeto em memória para fazer cache das conexões já abertas
const tenantClients: Record<string, PrismaClient> = {};

export function getTenantClient(tenantDbName: string): PrismaClient {
  // Se já temos uma conexão aberta para esta empresa, retornamos ela
  if (tenantClients[tenantDbName]) {
    return tenantClients[tenantDbName];
  }

  // Se não temos, construímos a URL de conexão específica dela.
  // Assumimos que todos os bancos "filhos" estão no mesmo servidor Postgres do Master
  const baseDbUrl = process.env.DATABASE_BASE_URL; // Ex: postgresql://user:pass@localhost:5432
  const databaseUrl = `${baseDbUrl}/${tenantDbName}?schema=public`;

  // Criamos uma nova instância do Prisma apontando APENAS para o banco desta empresa
  const client = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  // Guardamos no cache para as próximas requisições
  tenantClients[tenantDbName] = client;

  return client;
}