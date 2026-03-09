import type { FastifyRequest, FastifyReply } from 'fastify';
import { ServicesService } from './services.service';

const servicesService = new ServicesService();

export class ServicesController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const service = await servicesService.create(request.tenantDb, request.body);
    return reply.status(201).send(service);
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const services = await servicesService.listAll(request.tenantDb);
    return reply.send(services);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = await servicesService.findById(request.tenantDb, id);
    if (!service) return reply.status(404).send({ error: 'Serviço não encontrado' });
    return reply.send(service);
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = await servicesService.update(request.tenantDb, id, request.body);
    return reply.send(service);
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await servicesService.delete(request.tenantDb, id);
    return reply.status(204).send();
  }
}