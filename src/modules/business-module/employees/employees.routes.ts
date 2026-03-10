import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import { EmployeesController } from './employees.controller';

const employeesController = new EmployeesController();

export async function employeesRoutes(app: FastifyInstance) { 
  app.addHook('preHandler', businessMiddleware);

  app.post('/', employeesController.create);
  app.get('/', employeesController.list);
  app.get('/:id', employeesController.getById);
  app.patch('/:id', employeesController.update); 
  app.delete('/:id', employeesController.delete);
}