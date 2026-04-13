import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  listOrders, getOrder, createOrder, calculateOrderTotal, updateOrderStatus,
  cancelOrder, createProforma, convertProforma, assignDelivery, estimateTime,
  getQueueStatus, getDashboardSummary, generateDailyReport
} from './orders.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Orders
//
// Prefixo: /orders
// ─────────────────────────────────────────────────────────────

export async function ordersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  // ── Ações Estáticas / Dashboards ──
  app.post('/calculate',        calculateOrderTotal); // Simula preço antes de fechar
  app.get( '/queue',            getQueueStatus);      // Painel da Cozinha/Expedição
  app.get( '/dashboard',        getDashboardSummary); // Faturamento rápido
  app.get( '/report/:date',     generateDailyReport); // Relatório detalhado do dia

  // ── Operações de Orçamento (Proforma) ──
  app.post('/proforma',          createProforma);
  app.post('/:id/convert',       convertProforma); // Transforma em pedido real e baixa estoque

  // ── CRUD Base ──
  app.get( '/', listOrders);
  app.get( '/:id', getOrder);
  app.post('/', createOrder);

  // ── Máquina de Estados e Gestão do Pedido ──
  app.patch('/:id/status',       updateOrderStatus);
  app.patch('/:id/cancel',       cancelOrder);       // Devolve estoque
  
  // ── Logística ──
  app.patch('/:id/assign',       assignDelivery);    // Atribui motoboy
  app.get(  '/:id/estimate',     estimateTime);      // Retorna previsão pro cliente
}