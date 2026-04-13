import type { FastifyInstance } from 'fastify';
import { businessMiddleware } from '../../../shared/middlewares/business.middleware';
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployee,
} from './employees.controller';

// ─────────────────────────────────────────────────────────────
// ROTAS — Employees
//
// Prefixo registrado no app.ts: /employees
// ─────────────────────────────────────────────────────────────

export async function employeesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', businessMiddleware);

  app.get(   '/',             listEmployees);   // Listar com filtros
  app.get(   '/:id',          getEmployee);     // Buscar por ID
  app.post(  '/',             createEmployee);  // Criar
  app.put(   '/:id',          updateEmployee);  // Atualizar
  app.delete('/:id',          deleteEmployee);  // Deletar
  app.patch( '/:id/toggle',   toggleEmployee);  // Ativar / Desativar
}