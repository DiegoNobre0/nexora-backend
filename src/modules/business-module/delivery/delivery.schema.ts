import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Delivery Zones
// ─────────────────────────────────────────────────────────────

export const createDeliveryZoneSchema = z.object({
  name:       z.string({ error: 'Nome é obrigatório.' }).min(2).max(100).trim(),
  type:       z.enum(['RADIUS_KM', 'DISTRICT', 'ZIP_CODE', 'FIXED'], { error: 'Tipo de zona inválido.' }),
  value:      z.string({ error: 'Valor da regra é obrigatório (ex: "5" para 5km, ou "Centro" para bairro).' }).trim(),
  fee:        z.coerce.number({ error: 'Taxa de entrega é obrigatória.' }).min(0),
  free_above: z.coerce.number().min(0).optional(), // Frete grátis se o pedido passar desse valor
  min_order:  z.coerce.number().min(0).optional(), // Pedido mínimo para entregar nessa zona
  is_active:  z.boolean().default(true),
});

export const updateDeliveryZoneSchema = createDeliveryZoneSchema.partial();

export const listDeliveryZonesSchema = z.object({
  type:      z.enum(['RADIUS_KM', 'DISTRICT', 'ZIP_CODE', 'FIXED']).optional(),
  is_active: z.coerce.boolean().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(100).default(20),
});

// Schema para o cálculo dinâmico do frete no momento do pedido ou carrinho
export const calculateDeliverySchema = z.object({
  order_amount: z.coerce.number().positive('Valor do pedido deve ser maior que zero.'),
  distance_km:  z.coerce.number().min(0).optional(), // Enviado pelo front/bot via Google Maps API
  district:     z.string().trim().optional(),        // Nome do bairro
  zip_code:     z.string().trim().optional(),        // CEP
});

export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;
export type UpdateDeliveryZoneInput = z.infer<typeof updateDeliveryZoneSchema>;
export type ListDeliveryZonesInput  = z.infer<typeof listDeliveryZonesSchema>;
export type CalculateDeliveryInput  = z.infer<typeof calculateDeliverySchema>;