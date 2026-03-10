import type { FastifyInstance } from 'fastify';
import { ConfigsController } from './configs.controller';
import { businessMiddleware } from 'src/shared/middlewares/business.middleware';

const configsController = new ConfigsController();

export async function configsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  app.get('/', configsController.show);
  app.patch('/', configsController.update);
}