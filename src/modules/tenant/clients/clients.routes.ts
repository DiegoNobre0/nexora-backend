import type { FastifyInstance } from 'fastify';
import { ClientsController } from './clients.controller';
import { tenantMiddleware } from '../../../shared/middlewares/tenant.middleware';

const clientsController = new ClientsController();

export async function clientsRoutes(app: FastifyInstance) {
  /**
   * 🛡️ APLICANDO O MIDDLEWARE
   * O 'preHandler' garante que o middleware seja executado ANTES de chegar
   * nos métodos do controller. Ele vai validar o JWT e conectar no banco do cliente.
   */
  app.addHook('preHandler', tenantMiddleware);

  // Rota para cadastrar um novo cliente da barbearia
  app.post('/', clientsController.handleCreate);

  // Rota para listar todos os clientes daquela unidade específica
  app.get('/', clientsController.handleList);
}