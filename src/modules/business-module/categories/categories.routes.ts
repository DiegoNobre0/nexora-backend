import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategory,
} from './categories.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Categories
//
// Prefixo registrado no app.ts: /categories
//
// O businessMiddleware roda antes de qualquer rota deste módulo.
// Ele valida o JWT, resolve o banco da empresa e injeta no request.
// ─────────────────────────────────────────────────────────────

export async function categoriesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  app.get(   '/',           listCategories);  // Listar com filtros e paginação
  app.get(   '/:id',        getCategory);     // Buscar por ID
  app.post(  '/',           createCategory);  // Criar nova categoria
  app.put(   '/:id',        updateCategory);  // Atualizar categoria
  app.delete('/:id',        deleteCategory);  // Deletar categoria
  app.patch( '/:id/toggle', toggleCategory);  // Ativar / Desativar
}