import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  listClients,
  getClientById,
  getClientByDocument,
  createClient,
  updateClient,
  blockClient,
  unblockClient,
  mergeClients,
  addAddress,
  updateAddress,
  deleteAddress,
  exportClientsCSV
} from './clients.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Clients
//
// Prefixo registrado no app.ts: /clients
// ─────────────────────────────────────────────────────────────

export async function clientsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  // ── Rotas Estáticas / Ações ──
  app.get('/export', exportClientsCSV);
  app.post('/merge', mergeClients);
  app.get('/document/:doc', getClientByDocument);

  // ── CRUD Base ──
  app.get(   '/', listClients);
  app.get(   '/:id', getClientById);
  app.post(  '/', createClient);
  app.put(   '/:id', updateClient);
  
  // ── Bloqueios ──
  app.patch( '/:id/block', blockClient);
  app.patch( '/:id/unblock', unblockClient);

  // ── Endereços ──
  app.post(  '/:id/addresses', addAddress);
  app.put(   '/addresses/:addressId', updateAddress);
  app.delete('/addresses/:addressId', deleteAddress);
}