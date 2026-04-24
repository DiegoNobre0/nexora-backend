import { z } from 'zod';

export const createPromoKitSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  is_active: z.coerce.boolean().default(true),
  // O Angular envia a lista de produtos convertida em string JSON (ex: "[{"product_id":"123","quantity":2}]")
  items: z.string().transform((str) => {
    try {
      const parsed = JSON.parse(str);
      return z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive()
      })).parse(parsed);
    } catch {
      throw new Error('Formato inválido para itens do kit.');
    }
  }),
});

export type CreatePromoKitInput = z.infer<typeof createPromoKitSchema>;

export const updatePromoKitSchema = createPromoKitSchema.partial();

export type UpdatePromoKitInput = z.infer<typeof updatePromoKitSchema>;