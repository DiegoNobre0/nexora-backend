import type { FastifyInstance } from 'fastify';
import { ServicesController } from './services.controller';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';

const servicesController = new ServicesController();

export async function servicesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  app.post('/', servicesController.create);
  app.get('/', servicesController.list);
  app.get('/:id', servicesController.getById);
  app.patch('/:id', servicesController.update);
  app.delete('/:id', servicesController.delete);
}