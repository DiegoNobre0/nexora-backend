import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS DE VALIDAÇÃO — Categories
//
// Zod valida os dados ANTES de chegarem ao service.
// Se falhar, o setErrorHandler global captura e retorna 400.
// ─────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z
    .string({ error: 'O nome da categoria é obrigatório.' })
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(60, 'O nome deve ter no máximo 60 caracteres.')
    .trim(),

  // Slug é opcional — se não enviado, é gerado automaticamente a partir do nome.
  // Ex: "Frios e Laticínios" → "frios-e-laticinios"
  slug: z
    .string()
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens.')
    .optional(),

  is_active: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(60)
    .trim()
    .optional(),

  slug: z
    .string()
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens.')
    .optional(),

  is_active: z.boolean().optional(),
});

// Query params para listagem — z.coerce converte string da URL para o tipo correto
export const listCategoriesSchema = z.object({
  name:      z.string().trim().optional(),
  is_active: z.coerce.boolean().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(100).default(20),
});

// ─── Tipos inferidos dos schemas (usados em todo o módulo) ───
export type CreateCategoryInput  = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput  = z.infer<typeof updateCategorySchema>;
export type ListCategoriesInput  = z.infer<typeof listCategoriesSchema>;