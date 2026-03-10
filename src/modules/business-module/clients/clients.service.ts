import { PrismaClient as BusinessClient } from '@prisma/business-client';

export class ClientsService {
  async create(businessClient: BusinessClient, data: any) {
    return await businessClient.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        birth_date: data.birth_date ? new Date(data.birth_date) : null,
        notes: data.notes,
      },
    });
  }

  async listAll(businessClient: BusinessClient) {
    return await businessClient.client.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(businessClient: BusinessClient, id: string) {
    return await businessClient.client.findUnique({
      where: { id },
    });
  }

  async update(businessClient : BusinessClient, id: string, data: any) {
    return await businessClient.client.update({
      where: { id },
      data: {
        ...data,
        birth_date: data.birth_date ? new Date(data.birth_date) : undefined,
      },
    });
  }

  async delete(businessClient: BusinessClient, id: string) {
    return await businessClient.client.delete({
      where: { id },
    });
  }
}