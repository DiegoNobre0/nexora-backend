import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  listLeads, createLead, captureLeadData, updateLeadStatus, assignLead,
  convertLeadToClient, archiveLead, getLeadTimeline, registerFollowUp,
  getConversionRate, getSourceReport, exportLeadsCSV
} from './leads.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Leads
//
// Prefixo: /leads
// ─────────────────────────────────────────────────────────────

export async function leadsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  // ── Rotas Estáticas (Relatórios) ──
  app.get('/reports/conversion', getConversionRate);
  app.get('/reports/sources',    getSourceReport);
  app.get('/export',             exportLeadsCSV);

  // ── Operações de Lista / Criação ──
  app.get('/',  listLeads);
  app.post('/', createLead);

  // ── Ações no Lead (Por ID) ──
  app.put(  '/:id/data',     captureLeadData);
  app.patch('/:id/status',   updateLeadStatus);
  app.patch('/:id/assign',   assignLead);
  app.post( '/:id/convert',  convertLeadToClient); // Motor de Conversão
  app.patch('/:id/archive',  archiveLead);

  // ── Timeline / CRM ──
  app.get( '/:id/timeline', getLeadTimeline);
  app.post('/:id/timeline', registerFollowUp);
}