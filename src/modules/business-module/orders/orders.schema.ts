import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Orders
// ─────────────────────────────────────────────────────────────

export const orderItemSchema = z.object({
  product_id: z.string().uuid('ID do produto inválido.'),
  quantity:   z.coerce.number().int().positive('Quantidade deve ser maior que zero.'),
  notes:      z.string().max(200).optional(),
});

export const createOrderSchema = z.object({
  client_id:    z.string().uuid().optional(), // Pode ser opcional em venda de balcão anônima
  address_id:   z.string().uuid().optional(), // Necessário se type for DELIVERY
  employee_id:  z.string().uuid().optional(),
  channel:      z.enum(['WHATSAPP', 'WEBSITE', 'COUNTER', 'INSTAGRAM']).default('WHATSAPP'),
  type:         z.enum(['DELIVERY', 'PICKUP', 'COUNTER']).default('DELIVERY'),
  items:        z.array(orderItemSchema).min(1, 'O pedido deve ter pelo menos um item.'),
  notes:        z.string().max(1000).optional(),
  is_proforma:  z.boolean().default(false), // true = orçamento (não baixa estoque)
  discount:     z.coerce.number().min(0).default(0),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_DELIVERY', 'DELIVERED'], { 
    error: 'Status inválido.' 
  }),
});

export const cancelOrderSchema = z.object({
  cancel_reason: z.string({ error: 'Motivo do cancelamento é obrigatório.' }).min(5).max(255),
});

export const assignDeliverySchema = z.object({
  employee_id: z.string().uuid('ID do entregador inválido.'),
});

export const listOrdersSchema = z.object({
  status:    z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_DELIVERY', 'DELIVERED', 'CANCELED']).optional(),
  channel:   z.enum(['WHATSAPP', 'WEBSITE', 'COUNTER', 'INSTAGRAM']).optional(),
  client_id: z.string().uuid().optional(),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Filtro por data YYYY-MM-DD
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(100).default(20),
});

export const calculateTotalSchema = z.object({
  items:      z.array(orderItemSchema).min(1),
  address_id: z.string().uuid().optional(),
  type:       z.enum(['DELIVERY', 'PICKUP', 'COUNTER']).default('DELIVERY'),
});

export type OrderItemInput        = z.infer<typeof orderItemSchema>;
export type CreateOrderInput      = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput= z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput      = z.infer<typeof cancelOrderSchema>;
export type AssignDeliveryInput   = z.infer<typeof assignDeliverySchema>;
export type ListOrdersInput       = z.infer<typeof listOrdersSchema>;
export type CalculateTotalInput   = z.infer<typeof calculateTotalSchema>;