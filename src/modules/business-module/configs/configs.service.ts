import { PrismaClient as BusinessClient } from '@prisma/business-client';

export class ConfigsService {
  async get(businessClient: BusinessClient) {
    // Como só existe UMA config por empresa, usamos o findFirst
    let config = await businessClient.config.findFirst();
    
    if (!config) {
      // Se não existir, criamos a padrão
      config = await businessClient.config.create({ data: { auto_reply: true } });
    }
    return config;
  }

  async update(businessClient: BusinessClient, data: any) {
    const config = await this.get(businessClient);
    return await businessClient.config.update({
      where: { id: config.id },
      data
    });
  }
}