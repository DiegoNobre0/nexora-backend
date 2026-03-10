import { FastifyInstance } from 'fastify';
import { CompaniesController } from './companies.controller';

const companiesController = new CompaniesController();

export async function companiesRoutes(app: FastifyInstance) {
  // Aqui você deve adicionar um middleware de Admin futuramente
  app.post('/', companiesController.handleCreate);
  app.get('/', companiesController.handleList);
}