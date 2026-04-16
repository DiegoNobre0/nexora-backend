import type { FastifyInstance } from 'fastify';
import { UsersController } from './users.controller';
import { authMiddleware, requireRole } from 'src/shared/middlewares/master.middleware';

const usersController = new UsersController();

export async function usersRoutes(app: FastifyInstance) {
  // Adiciona a verificação de JWT para todas as rotas de usuários
  app.addHook('preHandler', authMiddleware);

  app.get('/', usersController.list);
  // app.post('/', usersController.create);
  app.post('/', { preHandler: [requireRole(['OWNER'])] }, usersController.create);
}