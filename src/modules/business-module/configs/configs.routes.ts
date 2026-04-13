import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  getConfig,
  updateConfig,
  getStatus,
} from './configs.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Configs
//
// Prefixo registrado no app.ts: /configs
// ─────────────────────────────────────────────────────────────

export async function configsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  app.get('/',       getConfig);     // Pega os dados brutos de configuração
  app.put('/',       updateConfig);  // Atualiza as configurações (não precisa de ID)
  app.get('/status', getStatus);     // Retorna { is_open: boolean } para o PWA/Front
}