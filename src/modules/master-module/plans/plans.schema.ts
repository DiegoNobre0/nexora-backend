import { z } from 'zod';

// As features definem o que o plano libera. É um JSON flexível.
const planFeaturesSchema = z.object({
  max_users:        z.number().int(),
  max_orders_month: z.number().int(),
  max_products:     z.number().int(),
  bot_ai:           z.boolean(),
  leads_crm:        z.boolean(),
  nfce:             z.boolean(),
  nfe:              z.boolean(),
  multi_unit:       z.boolean(),
  cash_register:    z.boolean(),
  boleto:           z.boolean(),
}).catchall(z.any()); // Permite adicionar novas chaves dinamicamente

export const createPlanSchema = z.object({
  name:          z.string({ error: 'Nome do plano é obrigatório.' }).min(2).trim(),
  price:         z.coerce.number().min(0, 'Preço não pode ser negativo.'),
  max_employees: z.coerce.number().int().default(-1), // -1 = Ilimitado
  features:      planFeaturesSchema,
  is_active:     z.boolean().default(true),
});

export const updatePlanSchema = createPlanSchema.partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;