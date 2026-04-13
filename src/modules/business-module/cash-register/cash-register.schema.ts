import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Cash Register
// ─────────────────────────────────────────────────────────────

export const openRegisterSchema = z.object({
  employee_id:     z.string().uuid('ID do operador inválido.'),
  opening_balance: z.coerce.number().min(0, 'Saldo de abertura não pode ser negativo.').default(0),
  notes:           z.string().max(255).optional(),
});

export const closeRegisterSchema = z.object({
  counted_balance: z.coerce.number().min(0, 'O valor contado não pode ser negativo.'),
  diff_reason:     z.string().max(255).optional(),
});

export const movementSchema = z.object({
  amount:      z.coerce.number().positive('O valor deve ser maior que zero.'),
  description: z.string({ error: 'A descrição/motivo é obrigatória.' }).min(3).max(255),
});

export const manualEntrySchema = movementSchema.extend({
  type: z.enum(['MANUAL_IN', 'MANUAL_OUT'], { error: 'Tipo deve ser MANUAL_IN ou MANUAL_OUT' }),
});

export type OpenRegisterInput   = z.infer<typeof openRegisterSchema>;
export type CloseRegisterInput  = z.infer<typeof closeRegisterSchema>;
export type MovementInput       = z.infer<typeof movementSchema>;
export type ManualEntryInput    = z.infer<typeof manualEntrySchema>;