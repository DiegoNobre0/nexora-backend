import { masterDb } from "src/database/master";

export class PlansService {
  async listActive() {
    return await masterDb.plan.findMany({ where: { is_active: true } });
  }

  async findDefault() {
    // Busca o plano "Free" ou "Trial" para novos clientes
    return await masterDb.plan.findFirst({ 
      where: { name: { contains: 'Trial' } } 
    });
  }
}