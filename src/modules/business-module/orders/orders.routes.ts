import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import { OrderController } from './orders.controller';

const orderController = new OrderController();

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  app.post('/', orderController.handleCreate);
  app.get('/', orderController.handleList); // Aceita ?date=YYYY-MM-DD
  app.patch('/:id/status', orderController.handleStatusUpdate);
  app.get('/availability', orderController.handleAvailability);
}