import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SCHEMAS — Products
// ─────────────────────────────────────────────────────────────

const parseJsonArray = (val: unknown) => {
  if (typeof val === 'string') {
    try {
      // Se for um JSON stringificado (como enviamos no barcodes)
      return JSON.parse(val);
    } catch {
      // Se o FormData enviar apenas um ID isolado como string, transformamos num array de 1 item
      return [val];
    }
  }
  // Se o Fastify multipart parser já conseguiu agrupar em array (ex: category_ids[]), retorna ele
  if (Array.isArray(val)) return val;
  return [];
};

export const createProductSchema = z.object({
  
  // 1. Preprocessando category_ids (garantindo que vira um array de strings)
  category_ids: z.preprocess(
    parseJsonArray,
    z.array(z.string().uuid('ID de categoria inválido.')).optional().default([])
  ),

  // 2. Preprocessando barcodes (garantindo que o JSON vira um array de objetos)
  barcodes: z.preprocess(
    parseJsonArray,
    z.array(
      z.object({
        code: z.string().min(1, 'Código de barras é obrigatório.'),
        unit: z.string().max(10).optional().default('UN'),
      })
    ).optional().default([])
  ),

  name: z.string({ error: 'Nome é obrigatório.' }).min(2).max(120).trim(),
  description: z.string().max(1000).trim().optional(),
  
  // O coerce cuida das strings numéricas do FormData
  price: z.coerce.number({ error: 'Preço é obrigatório.' }).positive('Preço deve ser maior que zero.'),
  price_wholesale: z.coerce.number().positive().optional(),
  cost_price: z.coerce.number().positive().optional(),
  
  stock_qty: z.coerce.number().int().min(0).default(0),
  stock_min: z.coerce.number().int().min(0).default(0),
  
  ncm: z.string().max(10).optional().nullable(),
  cfop: z.string().max(5).optional().nullable(),
  unit: z.string().max(10).default('UN'),
  
  // Preprocessando booleanos porque o FormData envia "true" ou "false" em string
  is_active: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  
  image_url: z.string().url().optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsSchema = z.object({
  name:        z.string().trim().optional(),
  category_id: z.string().uuid().optional(),
  is_active:   z.coerce.boolean().optional(),
  low_stock:   z.coerce.boolean().optional(),   // filtrar produtos abaixo do estoque mínimo
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(20),
});

// Operações de estoque — cada uma tem semântica diferente
export const updateStockSchema = z.object({
  operation:  z.enum(['IN', 'OUT', 'ADJUST'], {
    error: 'Operação deve ser IN (entrada), OUT (saída) ou ADJUST (ajuste).',
  }),
  quantity:   z.coerce.number().int().positive('Quantidade deve ser maior que zero.'),
  reason:     z.string().max(200).optional(),   // motivo da movimentação
});

export const registerBarcodeSchema = z.object({
  code: z.string({ error: 'Código de barras é obrigatório.' }).min(4).max(50).trim(),
  unit: z.string().max(10).default('UN'),
});

export type CreateProductInput  = z.infer<typeof createProductSchema>;
export type UpdateProductInput  = z.infer<typeof updateProductSchema>;
export type ListProductsInput   = z.infer<typeof listProductsSchema>;
export type UpdateStockInput    = z.infer<typeof updateStockSchema>;
export type RegisterBarcodeInput = z.infer<typeof registerBarcodeSchema>;