import type { FastifyInstance } from 'fastify';
import { ClientsController } from './clients.controller';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';

const clientsController = new ClientsController();

export async function clientsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  app.post('/', clientsController.handleCreate);
  app.get('/', clientsController.handleList);
  
  // Rotas específicas por ID
  app.get('/:id', clientsController.handleGetById);
  app.patch('/:id', clientsController.handleUpdate);
  app.delete('/:id', clientsController.handleDelete);
}