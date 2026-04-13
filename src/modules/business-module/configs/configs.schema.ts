import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Configs
// ─────────────────────────────────────────────────────────────

// Regex para validar formato de hora "HH:mm" (ex: 08:30, 23:59)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dayConfigSchema = z.object({
  active: z.boolean(),
  open:   z.string().regex(timeRegex, 'Horário de abertura inválido. Use HH:mm'),
  close:  z.string().regex(timeRegex, 'Horário de fechamento inválido. Use HH:mm'),
});

const operatingHoursSchema = z.object({
  sunday:    dayConfigSchema,
  monday:    dayConfigSchema,
  tuesday:   dayConfigSchema,
  wednesday: dayConfigSchema,
  thursday:  dayConfigSchema,
  friday:    dayConfigSchema,
  saturday:  dayConfigSchema,
});

export const updateConfigSchema = z.object({
  whatsapp_number:      z.string().max(20).optional(),
  whatsapp_token:       z.string().optional(),
  whatsapp_phone_id:    z.string().optional(),
  whatsapp_waba_id:     z.string().optional(),
  
  ai_prompt:            z.string().max(2000).optional(),
  auto_reply:           z.boolean().optional(),
  
  operating_hours:      operatingHoursSchema.optional(),
  // Array de datas no formato YYYY-MM-DD
  holiday_dates:        z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD')).optional(),
  out_of_hours_message: z.string().max(1000).optional(),
  
  min_order_amount:     z.coerce.number().min(0).optional(),
  free_delivery_above:  z.coerce.number().min(0).optional(),
});

export type UpdateConfigInput  = z.infer<typeof updateConfigSchema>;
export type OperatingHours     = z.infer<typeof operatingHoursSchema>;