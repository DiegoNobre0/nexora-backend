import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  listDeliveryZones,
  getDeliveryZone,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  calculateDeliveryFee,
} from './delivery.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Delivery
//
// Prefixo registrado no app.ts: /delivery
// ─────────────────────────────────────────────────────────────

export async function deliveryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  // IMPORTANTE: Rotas estáticas antes de rotas dinâmicas (/:id)
  app.post('/calculate', calculateDeliveryFee); // Calcula o frete de um pedido

  // CRUD base
  app.get(   '/',    listDeliveryZones);  // Listar com filtros
  app.get(   '/:id', getDeliveryZone);    // Buscar por ID
  app.post(  '/',    createDeliveryZone); // Criar
  app.put(   '/:id', updateDeliveryZone); // Atualizar
  app.delete('/:id', deleteDeliveryZone); // Deletar
}