import type { FastifyRequest, FastifyReply } from 'fastify';
import { ClientsService } from './clients.service';

const clientsService = new ClientsService();

export class ClientsController {
  async handleCreate(request: FastifyRequest, reply: FastifyReply) {
    const db = request.tenantDb;
    const client = await clientsService.create(db, request.body);
    return reply.status(201).send(client);
  }

  async handleList(request: FastifyRequest, reply: FastifyReply) {
    const db = request.tenantDb;
    const clients = await clientsService.list(db);
    return reply.send(clients);
  }
}