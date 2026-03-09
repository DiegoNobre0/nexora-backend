import type { FastifyInstance } from 'fastify';
import { tenantMiddleware } from '../../../shared/middlewares/tenant.middleware';
import { EmployeesController } from './employees.controller';

const employeesController = new EmployeesController();

export async function employeesRoutes(app: FastifyInstance) {
  // 🛡️ AQUI: O middleware intercepta todas as rotas abaixo
  // Ele lê o JWT, descobre o tenant_db_name e injeta o prisma no request.tenantDb
  app.addHook('preHandler', tenantMiddleware);

  app.post('/', employeesController.create);
  app.get('/', employeesController.list);
  app.get('/:id', employeesController.getById);
  app.patch('/:id', employeesController.update); 
  app.delete('/:id', employeesController.delete);
}