import { PrismaClient as TenantClient } from '@prisma/tenant-client';

export class EmployeesService {
  async create(db: TenantClient, data: { name: string; phone?: string }) {
    return await db.employee.create({
      data: {
        name: data.name,
        phone: data.phone,
        is_active: true
      }
    });
  }

  async listAll(db: TenantClient) {
    return await db.employee.findMany({
      where: { is_active: true },
      include: { services: true } // Já traz os serviços que ele faz
    });
  }
}