import { PrismaClient as BusinessClient } from '@prisma/business-client';

export class ServicesService {
  async create(businessClient: BusinessClient, data: any) {
    return await businessClient.service.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        duration_minutes: data.duration_minutes,
        is_active: true
      }
    });
  }

  async listAll(businessClient: BusinessClient) {
    return await businessClient.service.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });
  }

  async findById(businessClient: BusinessClient, id: string) {
    return await businessClient.service.findUnique({
      where: { id }
    });
  }

  async update(businessClient : BusinessClient, id: string, data: any) {
    return await businessClient.service.update({
      where: { id },
      data
    });
  }

  async delete(businessClient: BusinessClient, id: string) {  
    return await businessClient.service.update({
      where: { id },
      data: { is_active: false }
    });
  }
}