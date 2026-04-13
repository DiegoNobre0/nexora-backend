import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Taxes
// ─────────────────────────────────────────────────────────────

export const createTaxSchema = z.object({
  name:           z.string({ error: 'Nome é obrigatório.' }).min(2).max(100).trim(),
  type:           z.enum(['PERCENTAGE', 'FIXED', 'MIXED'], { error: 'Tipo inválido.' }),
  method:         z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO', 'CASH', 'VR', 'VA', 'STORE_CREDIT']).optional(),
  brand:          z.string().max(30).trim().optional(),   // ex: VISA_MASTER, ALELO, SODEXO
  installments:   z.coerce.number().int().min(1).max(12).optional(), // até quantas parcelas essa taxa se aplica
  rate:           z.coerce.number().min(0).max(1),        // percentual em decimal: 2,99% = 0.0299
  fixed_amount:   z.coerce.number().min(0).default(0),   // valor fixo em reais por transação
  pass_to_client: z.boolean().default(false),             // se a taxa é repassada ao cliente
  is_active:      z.boolean().default(true),
});

export const updateTaxSchema = createTaxSchema.partial();

export const listTaxesSchema = z.object({
  method:    z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO', 'CASH', 'VR', 'VA', 'STORE_CREDIT']).optional(),
  is_active: z.coerce.boolean().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(100).default(20),
});

// Schema para calcular a taxa de um pagamento específico
export const calculateFeeSchema = z.object({
  method:       z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO', 'VR', 'VA'], { error: 'Método de pagamento inválido.' }),
  amount:       z.coerce.number().positive('Valor deve ser maior que zero.'),
  brand:        z.string().max(30).optional(),  // necessário para cartão
  installments: z.coerce.number().int().min(1).max(12).default(1),
});

export type CreateTaxInput    = z.infer<typeof createTaxSchema>;
export type UpdateTaxInput    = z.infer<typeof updateTaxSchema>;
export type ListTaxesInput    = z.infer<typeof listTaxesSchema>;
export type CalculateFeeInput = z.infer<typeof calculateFeeSchema>;