// 1. A importação com o caminho correto apontando para o node_modules
import { PrismaClient as TenantClient } from '@prisma/tenant-client';
const tenantClients = {};
export function getTenantClient(tenantDbName) {
    if (tenantClients[tenantDbName]) {
        return tenantClients[tenantDbName];
    }
    const baseDbUrl = process.env.DATABASE_BASE_URL;
    const databaseUrl = `${baseDbUrl}/${tenantDbName}?schema=public`;
    const client = new TenantClient({
        datasources: {
            tenantdb: { url: databaseUrl },
        },
    });
    tenantClients[tenantDbName] = client;
    return client;
}
