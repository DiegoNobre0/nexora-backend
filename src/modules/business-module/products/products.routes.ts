import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  listProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  pauseProduct,
  updateStock,
  checkAvailability,
  getLowStockAlert,
  registerBarcode,
  removeBarcode,
} from './products.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Products
//
// Prefixo registrado no app.ts: /products
//
// IMPORTANTE: rotas estáticas (/low-stock, /barcode/:code)
// devem ser registradas ANTES das rotas dinâmicas (/:id)
// para evitar conflito de matching no Fastify.
// ─────────────────────────────────────────────────────────────

export async function productsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  // ── Rotas estáticas (registrar antes das dinâmicas) ────────
  app.get('/low-stock',          getLowStockAlert);      // Produtos abaixo do estoque mínimo
  app.get('/barcode/:code',      getProductByBarcode);   // Buscar por código de barras

  // ── CRUD base ──────────────────────────────────────────────
  app.get(   '/',    listProducts);    // Listar com filtros
  app.get(   '/:id', getProduct);      // Buscar por ID
  app.post(  '/',    createProduct);   // Criar
  app.put(   '/:id', updateProduct);   // Atualizar
  app.delete('/:id', deleteProduct);   // Deletar

  // ── Ações específicas ──────────────────────────────────────
  app.patch('/:id/pause',            pauseProduct);       // Pausar / Reativar
  app.patch('/:id/stock',            updateStock);        // Movimentar estoque
  app.get(  '/:id/availability',     checkAvailability);  // Verificar disponibilidade

  // ── Códigos de barras ──────────────────────────────────────
  app.post(  '/:id/barcodes',              registerBarcode);  // Vincular código
  app.delete('/:id/barcodes/:barcodeId',   removeBarcode);    // Remover código
}