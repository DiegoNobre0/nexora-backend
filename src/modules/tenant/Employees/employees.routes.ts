import type { FastifyInstance } from 'fastify';
import { EmployeesController } from './employees.controller';
import { tenantMiddleware } from '../../../shared/middlewares/tenant.middleware';

const employeesController = new EmployeesController();

export async function employeesRoutes(app: FastifyInstance) {
  // 🛡️ AQUI: O middleware intercepta todas as rotas abaixo
  // Ele lê o JWT, descobre o tenant_db_name e injeta o prisma no request.tenantDb
  app.addHook('preHandler', tenantMiddleware);

  app.post('/', employeesController.create);
  app.get('/', employeesController.list);
}