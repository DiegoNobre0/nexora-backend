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

  async findById(db: TenantClient, id: string) {
    return await db.employee.findUnique({
      where: { id },
      include: { services: true }
    });
  }

  async update(db: TenantClient, id: string, data: { name?: string; phone?: string; is_active?: boolean }) {
    return await db.employee.update({
      where: { id },
      data
    });
  }

  async delete(db: TenantClient, id: string) {
    // Aqui fazemos o Soft Delete para manter a integridade dos dados
    return await db.employee.update({
      where: { id },
      data: { is_active: false }
    });
  }
}