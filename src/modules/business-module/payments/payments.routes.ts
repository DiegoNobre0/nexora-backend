import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  createIntent, generatePix, generateBoleto, getBoletoStatus,
  cancelBoleto, reissueBoleto, refundPayment, getReceipt, webhookHandler
} from './payments.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Payments
//
// Prefixo: /payments
// ─────────────────────────────────────────────────────────────

export async function paymentsRoutes(app: FastifyInstance) {
  // Nota Sênior: O webhookHandler está protegido pelo JWT. 
  // Na configuração do Asaas/MercadoPago, a URL do webhook precisará 
  // ser cadastrada com o header Authorization: Bearer <token>.
  // Se o gateway não suportar headers customizados, tire o webhook daqui
  // e coloque em uma rota pública no app.ts que resolva o DB pela URL.
  
  app.addHook('preHandler', businessMiddleware);

  // ── Criação ──
  app.post('/intent', createIntent); // Para cartão de crédito/débito
  app.post('/pix',    generatePix);
  app.post('/boleto', generateBoleto);

  // ── Webhook (Confirmação Externa) ──
  app.post('/webhook', webhookHandler);

  // ── Ações no Boleto ──
  app.get(  '/:id/boleto-status', getBoletoStatus);
  app.patch('/:id/boleto-cancel', cancelBoleto);
  app.post( '/:id/boleto-reissue', reissueBoleto);

  // ── Estornos e Recibos ──
  app.post('/:id/refund',  refundPayment);
  app.get( '/:id/receipt', getReceipt);
}