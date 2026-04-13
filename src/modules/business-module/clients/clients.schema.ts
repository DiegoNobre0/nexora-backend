import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Clients (PF & PJ)
// ─────────────────────────────────────────────────────────────

// O telefone é obrigatório e serve como principal identificador (WhatsApp)
const baseClientSchema = z.object({
  phone: z.string({ error: 'Telefone é obrigatório.' }).min(10).max(20).trim(),
  email: z.string().email('E-mail inválido.').trim().optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
  payment_terms:  z.coerce.number().int().min(0).optional(),
  price_table:    z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'CUSTOM']).optional(),
  credit_limit:   z.coerce.number().min(0).optional(),
});

// Schema para Pessoa Física
const pfClientSchema = baseClientSchema.extend({
  type:       z.literal('PF'),
  name:       z.string({ error: 'Nome é obrigatório.' }).min(2).max(100).trim(),
  cpf:        z.string().max(14).optional(),
  birth_date: z.string().datetime().optional(), // ISO string
});

// Schema para Pessoa Jurídica
const pjClientSchema = baseClientSchema.extend({
  type:          z.literal('PJ'),
  company_name:  z.string({ error: 'Razão social é obrigatória.' }).min(2).max(150).trim(),
  trade_name:    z.string().max(100).trim().optional(),
  cnpj:          z.string().max(18).optional(),
  state_reg:     z.string().max(30).optional(),
  municipal_reg: z.string().max(30).optional(),
  contact_name:  z.string().max(100).optional(),
  contact_role:  z.string().max(50).optional(),
});

export const createClientSchema = z.discriminatedUnion('type', [pfClientSchema, pjClientSchema]);
export const updateClientSchema = z.union([pfClientSchema.partial(), pjClientSchema.partial()]);

export const listClientsSchema = z.object({
  type:       z.enum(['PF', 'PJ']).optional(),
  is_blocked: z.coerce.boolean().optional(),
  search:     z.string().trim().optional(), // Busca por nome, telefone ou documento
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
});

export const blockClientSchema = z.object({
  reason: z.string({ error: 'Motivo do bloqueio é obrigatório.' }).min(5).max(255),
});

// ─── Schemas para Endereço ───────────────────────────────────

export const addressSchema = z.object({
  label:      z.string().max(50).default('Principal'),
  zip_code:   z.string().max(10).trim(),
  street:     z.string().min(2).max(150),
  number:     z.string().min(1).max(20),
  complement: z.string().max(100).optional(),
  district:   z.string().min(2).max(100),
  city:       z.string().min(2).max(100),
  state:      z.string().length(2), // Sigla UF
  is_default: z.boolean().default(false),
});

export const updateAddressSchema = addressSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsInput  = z.infer<typeof listClientsSchema>;
export type AddressInput      = z.infer<typeof addressSchema>;