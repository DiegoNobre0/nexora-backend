import type { FastifyInstance } from 'fastify';
import { PlansController } from './plans.controller';
import { authMiddleware, requireRole } from '../../../shared/middlewares/master.middleware';

const controller = new PlansController();

export async function plansRoutes(app: FastifyInstance) {
  // Rota pública para o site/onboarding ver os preços
  app.get('/', controller.listActive); 

  // Rotas protegidas (Apenas o Dono do Sistema / Super Admin)
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authMiddleware);
    protectedRoutes.addHook('preHandler', requireRole(['SUPERADMIN']));

    protectedRoutes.post('/', controller.create);
    protectedRoutes.put('/:id', controller.update);
  });
}