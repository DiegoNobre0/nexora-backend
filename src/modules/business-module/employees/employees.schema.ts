import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Employees
// ─────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  name:      z.string({ error: 'Nome é obrigatório.' }).min(2).max(100).trim(),
  phone:     z.string().max(20).trim().optional(),
  email:     z.string().email('E-mail inválido.').trim().optional(),
  role:      z.string().max(60).trim().optional(),  // ex: Vendedor, Caixa, Entregador
  is_active: z.boolean().default(true),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesSchema = z.object({
  name:      z.string().trim().optional(),
  role:      z.string().trim().optional(),
  is_active: z.coerce.boolean().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(100).default(20),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesInput  = z.infer<typeof listEmployeesSchema>;