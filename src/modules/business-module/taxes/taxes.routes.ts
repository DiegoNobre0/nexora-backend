import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  listTaxes,
  getTax,
  createTax,
  updateTax,
  deleteTax,
  calculateFee,
} from './taxes.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Taxes
//
// Prefixo registrado no app.ts: /taxes
//
// IMPORTANTE: /calculate deve ser registrada ANTES de /:id
// para evitar que o Fastify interprete "calculate" como um ID.
// ─────────────────────────────────────────────────────────────

export async function taxesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  // Rota estática — registrada antes da dinâmica /:id
  app.post('/calculate', calculateFee);   // Calcular taxa de um pagamento

  // CRUD base
  app.get(   '/',    listTaxes);    // Listar com filtros
  app.get(   '/:id', getTax);       // Buscar por ID
  app.post(  '/',    createTax);    // Criar
  app.put(   '/:id', updateTax);    // Atualizar
  app.delete('/:id', deleteTax);    // Deletar
}