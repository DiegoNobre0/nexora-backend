import { FastifyRequest, FastifyReply } from 'fastify';
import { CompaniesService } from './companies.service';

const companiesService = new CompaniesService();

export class CompaniesController {
  async handleCreate(request: FastifyRequest, reply: FastifyReply) {
    const company = await companiesService.create(request.body as any);
    return reply.status(201).send(company);
  }

  async handleList(request: FastifyRequest, reply: FastifyReply) {
    const companies = await companiesService.list();
    return reply.send(companies);
  }
}