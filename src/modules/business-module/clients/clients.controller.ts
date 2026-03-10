import type { FastifyRequest, FastifyReply } from 'fastify';
import { ClientsService } from './clients.service';

const clientsService = new ClientsService();

export class ClientsController {
  async handleCreate(request: FastifyRequest, reply: FastifyReply) {
    const client = await clientsService.create(request.tenantDb, request.body);
    return reply.status(201).send(client);
  }

  async handleList(request: FastifyRequest, reply: FastifyReply) {
    const clients = await clientsService.listAll(request.tenantDb);
    return reply.send(clients);
  }

  async handleGetById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const client = await clientsService.findById(request.tenantDb, id);
    if (!client) return reply.status(404).send({ error: 'Cliente não encontrado' });
    return reply.send(client);
  }

  async handleUpdate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const client = await clientsService.update(request.tenantDb, id, request.body);
    return reply.send(client);
  }

  async handleDelete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await clientsService.delete(request.tenantDb, id);
    return reply.status(204).send();
  }
}