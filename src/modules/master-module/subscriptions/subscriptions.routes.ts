import type { FastifyInstance } from 'fastify';
import { SubscriptionsController } from './subscriptions.controller';
import { authMiddleware, requireRole } from '../../../shared/middlewares/master.middleware';

const controller = new SubscriptionsController();

export async function subscriptionsRoutes(app: FastifyInstance) {
  // Webhook externo (Público, mas deve ter validação de header do Stripe/Asaas)
  app.post('/webhook', controller.webhook);

  // Área do Lojista logado
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authMiddleware);
    protectedRoutes.addHook('preHandler', requireRole(['OWNER'])); // Apenas o dono altera planos

    protectedRoutes.get('/me', controller.getCurrent);
    protectedRoutes.post('/change-plan', controller.changePlan);
    protectedRoutes.delete('/cancel', controller.cancel);
  });
}