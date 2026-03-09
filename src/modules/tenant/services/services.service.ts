import { PrismaClient as TenantClient } from '@prisma/tenant-client';

export class ServicesService {
  async create(db: TenantClient, data: any) {
    return await db.service.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        duration_minutes: data.duration_minutes,
        is_active: true
      }
    });
  }

  async listAll(db: TenantClient) {
    return await db.service.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });
  }

  async findById(db: TenantClient, id: string) {
    return await db.service.findUnique({
      where: { id }
    });
  }

  async update(db: TenantClient, id: string, data: any) {
    return await db.service.update({
      where: { id },
      data
    });
  }

  async delete(db: TenantClient, id: string) {  
    return await db.service.update({
      where: { id },
      data: { is_active: false }
    });
  }
}