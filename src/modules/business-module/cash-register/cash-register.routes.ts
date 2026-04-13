import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  getOpenRegister, openCashRegister, closeCashRegister,
  registerWithdrawal, registerSupply, registerManualEntry,
  getCashRegisterSummary, listMovements, generateClosingReport
} from './cash-register.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Cash Register
//
// Prefixo: /cash-register
// ─────────────────────────────────────────────────────────────

export async function cashRegisterRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  // ── Gestão de Status ──
  app.get('/open/:employeeId', getOpenRegister);  // Verifica se o usuário logado tem caixa aberto
  app.post('/open',            openCashRegister); // Abre um novo caixa
  app.post('/:id/close',       closeCashRegister); // Confere valores e fecha o caixa

  // ── Movimentações (Apenas em caixas abertos) ──
  app.post('/:id/withdraw',    registerWithdrawal);  // Sangria (Retirada física)
  app.post('/:id/supply',      registerSupply);      // Suprimento (Troco físico)
  app.post('/:id/manual',      registerManualEntry); // Outras entradas/saídas

  // ── Fechamento e Conferência ──
  app.get('/:id/summary',      getCashRegisterSummary); // Resumo em tempo real do caixa
  app.get('/:id/movements',    listMovements);          // Extrato de movimentações
  app.get('/:id/report',       generateClosingReport);  // Relatório consolidado (Para impressão)
}