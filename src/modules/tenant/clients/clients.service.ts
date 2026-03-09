import { PrismaClient as TenantClient } from '@prisma/tenant-client';

export class ClientsService {
  async create(db: TenantClient, data: any) {
    return await db.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        birth_date: data.birth_date ? new Date(data.birth_date) : null,
        notes: data.notes,
      },
    });
  }

  async listAll(db: TenantClient) {
    return await db.client.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(db: TenantClient, id: string) {
    return await db.client.findUnique({
      where: { id },
    });
  }

  async update(db: TenantClient, id: string, data: any) {
    return await db.client.update({
      where: { id },
      data: {
        ...data,
        birth_date: data.birth_date ? new Date(data.birth_date) : undefined,
      },
    });
  }

  async delete(db: TenantClient, id: string) {
    return await db.client.delete({
      where: { id },
    });
  }
}