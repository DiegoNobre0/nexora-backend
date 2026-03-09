import type { FastifyInstance } from 'fastify';
import { ServicesController } from './services.controller';
import { tenantMiddleware } from '../../../shared/middlewares/tenant.middleware';

const servicesController = new ServicesController();

export async function servicesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantMiddleware);

  app.post('/', servicesController.create);
  app.get('/', servicesController.list);
  app.get('/:id', servicesController.getById);
  app.patch('/:id', servicesController.update);
  app.delete('/:id', servicesController.delete);
}