import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Payments
// ─────────────────────────────────────────────────────────────

export const paymentMethodEnum = z.enum([
  'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO', 'CASH', 'VR', 'VA', 'STORE_CREDIT'
]);

export const createIntentSchema = z.object({
  order_id:     z.string().uuid().optional(),
  client_id:    z.string().uuid().optional(),
  method:       paymentMethodEnum,
  amount:       z.coerce.number().positive('O valor deve ser maior que zero.'),
  installments: z.coerce.number().int().min(1).max(12).default(1),
  brand:        z.string().max(30).optional(), // Ex: VISA, MASTERCARD (Útil para taxa exata)
});

export const generateBoletoSchema = z.object({
  order_id: z.string().uuid().optional(),
  amount:   z.coerce.number().positive(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)'),
});

export const refundPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(), // Opcional para estorno total
  reason: z.string({ error: 'Motivo do estorno é obrigatório.' }).min(5).max(255),
});

// Schema genérico para o Webhook (Baseado no padrão MercadoPago/Asaas)
export const webhookSchema = z.object({
  gateway_id: z.string(),
  status:     z.enum(['PAID', 'OVERDUE', 'CANCELED', 'REFUNDED']),
  paid_at:    z.string().datetime().optional(),
});

export type CreateIntentInput   = z.infer<typeof createIntentSchema>;
export type GenerateBoletoInput = z.infer<typeof generateBoletoSchema>;
export type RefundPaymentInput  = z.infer<typeof refundPaymentSchema>;
export type WebhookInput        = z.infer<typeof webhookSchema>;