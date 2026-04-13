import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Analytics
// ─────────────────────────────────────────────────────────────

// Schema padrão para filtros de período (Data inicial e final)
export const periodQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use formato YYYY-MM-DD.').optional(),
  end_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use formato YYYY-MM-DD.').optional(),
});

export const forecastQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
});

export const exportQuerySchema = periodQuerySchema.extend({
  format: z.enum(['CSV', 'JSON']).default('JSON'),
});

export type PeriodQueryInput = z.infer<typeof periodQuerySchema>;