import { masterDb } from '../../../database/master';
import { NotFoundError } from '../../../shared/errors/AppError';
import type { CreatePlanInput, UpdatePlanInput } from './plans.schema';

export class PlansService {
  
  async listAll(includeInactive = false) {
    return masterDb.plan.findMany({
      where: includeInactive ? undefined : { is_active: true },
      orderBy: { price: 'asc' },
    });
  }

  async getById(id: string) {
    const plan = await masterDb.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundError('Plano');
    return plan;
  }

  // ─── Ações de Admin (Requer Role SUPERADMIN) ───

  async create(input: CreatePlanInput) {
    return masterDb.plan.create({
      data: {
        name:          input.name,
        price:         input.price,
        max_employees: input.max_employees,
        features:      input.features as any, // Cast para o JSON do Prisma
        is_active:     input.is_active,
      }
    });
  }

  async update(id: string, input: UpdatePlanInput) {
    await this.getById(id);
    return masterDb.plan.update({
      where: { id },
      data: {
        ...input,
        ...(input.features && { features: input.features as any })
      }
    });
  }

  async toggleActive(id: string) {
    const plan = await this.getById(id);
    // Soft delete (não apagamos planos do banco para não quebrar assinaturas antigas)
    return masterDb.plan.update({
      where: { id },
      data: { is_active: !plan.is_active }
    });
  }
}