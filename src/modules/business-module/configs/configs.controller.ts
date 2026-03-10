import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigsService } from './configs.service';

const configsService = new ConfigsService();

export class ConfigsController {
  async show(request: FastifyRequest, reply: FastifyReply) {
    const config = await configsService.get(request.businessDb);
    return reply.send(config);
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const config = await configsService.update(request.businessDb, request.body);
    return reply.send(config);
  }
}