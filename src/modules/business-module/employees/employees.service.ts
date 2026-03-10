import { PrismaClient as BusinessClient } from '@prisma/business-client';

export class EmployeesService {
  async create(businessClient: BusinessClient, data: { name: string; phone?: string }) {
    return await businessClient.employee.create({
      data: {
        name: data.name,
        phone: data.phone,
        is_active: true
      }
    });
  }

  async listAll(businessClient: BusinessClient) {
    return await businessClient.employee.findMany({
      where: { is_active: true },
      include: { services: true } // Já traz os serviços que ele faz
    });
  }

  async findById(businessClient: BusinessClient, id: string) {
    return await businessClient.employee.findUnique({
      where: { id },
      include: { services: true }
    });
  }

  async update(businessClient : BusinessClient, id: string, data: { name?: string; phone?: string; is_active?: boolean }) {
    return await businessClient.employee.update({
      where: { id },
      data
    });
  }

  async delete(businessClient: BusinessClient, id: string) {
    // Aqui fazemos o Soft Delete para manter a integridade dos dados
    return await businessClient.employee.update({
      where: { id },
      data: { is_active: false }
    });
  }
}