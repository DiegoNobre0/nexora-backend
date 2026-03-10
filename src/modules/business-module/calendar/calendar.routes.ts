import type { FastifyInstance } from 'fastify';
import { CalendarController } from './calendar.controller';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';

const calendarController = new CalendarController();

export async function calendarRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  app.post('/', calendarController.handleCreate);
  app.get('/', calendarController.handleList); // Aceita ?date=YYYY-MM-DD
  app.patch('/:id/status', calendarController.handleStatusUpdate);
  app.get('/availability', calendarController.handleAvailability);
}