import { PrismaClient as TenantClient } from '@prisma/tenant-client';

export class ClientsService {
  async create(db: TenantClient, data: any) {
    return await db.client.create({ data });
  }

  async list(db: TenantClient) {
    return await db.client.findMany();
  }
}