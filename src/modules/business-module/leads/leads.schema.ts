import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Leads
// ─────────────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  phone:  z.string({ error: 'Telefone é obrigatório.' }).min(10).max(20).trim(),
  source: z.enum(['WHATSAPP', 'WEBSITE', 'INSTAGRAM', 'REFERRAL', 'MANUAL']).default('WHATSAPP'),
});

export const captureDataSchema = z.object({
  name:         z.string().min(2).max(100).trim().optional(),
  type:         z.enum(['PF', 'PJ']).optional(),
  company_name: z.string().max(150).trim().optional(),
  email:        z.string().email('E-mail inválido.').trim().optional().or(z.literal('')),
  interest:     z.string().max(200).optional(), // Ex: "Preço do produto X", "Prazo de entrega"
  notes:        z.string().max(1000).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'NURTURING', 'CONVERTED', 'ARCHIVED'], { error: 'Status inválido.' }),
});

export const assignLeadSchema = z.object({
  employee_id: z.string().uuid('ID do funcionário inválido.'),
});

export const registerFollowUpSchema = z.object({
  message:   z.string({ error: 'A mensagem do follow-up é obrigatória.' }).min(1),
  template:  z.string().optional(), // Caso tenha sido disparado um template oficial da Meta
  responded: z.boolean().default(false),
});

export const listLeadsSchema = z.object({
  status:      z.enum(['NEW', 'CONTACTED', 'NURTURING', 'CONVERTED', 'ARCHIVED']).optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  source:      z.enum(['WHATSAPP', 'WEBSITE', 'INSTAGRAM', 'REFERRAL', 'MANUAL']).optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(20),
});

export const reportQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30), // Relatório dos últimos X dias
});

export type CreateLeadInput      = z.infer<typeof createLeadSchema>;
export type CaptureDataInput     = z.infer<typeof captureDataSchema>;
export type RegisterFollowUpInput = z.infer<typeof registerFollowUpSchema>;
export type ListLeadsInput       = z.infer<typeof listLeadsSchema>;