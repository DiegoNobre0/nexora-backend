import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import { AnalyticsController } from './analytics.controller';

const controller = new AnalyticsController();

// ─────────────────────────────────────────────────────────────
// ROTAS — Analytics & Reports
//
// Prefixo: /analytics
// ─────────────────────────────────────────────────────────────

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  // ── Vendas & Produtos ──
  app.get('/top-products', controller.getTopProducts);
  app.get('/revenue-channel', controller.getRevenueChannel);
  app.get('/forecast/:id', controller.getDemandForecast);

  // ── CRM & Bot ──
  app.get('/bot-funnel', controller.getBotFunnel);
  app.get('/ltv/:clientId', controller.getLTV);

  // ── Financeiro & Contábil ──
  app.get('/dre', controller.getSimplifiedDRE);
  app.get('/cash-flow', controller.getCashFlow);
  
  // ── Contas a Receber & Inadimplência ──
  app.get('/receivables', controller.getAccountsReceivable);
  app.get('/receivables/export', controller.exportReceivablesCSV); // Exportação CSV
}