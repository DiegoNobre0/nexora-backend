import type { FastifyRequest, FastifyReply } from 'fastify';
import { PlansService } from './plans.service';
import { createPlanSchema, updatePlanSchema } from './plans.schema';

export class PlansController {
  async listActive(request: FastifyRequest, reply: FastifyReply) {
    const service = new PlansService();
    return reply.send(await service.listAll(false)); // Só ativos
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createPlanSchema.parse(request.body);
    const service = new PlansService();
    return reply.status(201).send(await service.create(body));
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = updatePlanSchema.parse(request.body);
    const service = new PlansService();
    return reply.send(await service.update(id, body));
  }
}