import type { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionsService } from './subscriptions.service';
import { changePlanSchema, billingWebhookSchema } from './subscriptions.schema';

export class SubscriptionsController {
  async getCurrent(request: FastifyRequest, reply: FastifyReply) {
    const { company_id } = request.user as any; // Pego do authMiddleware
    const service = new SubscriptionsService();
    return reply.send(await service.getCurrentSubscription(company_id));
  }

  async changePlan(request: FastifyRequest, reply: FastifyReply) {
    const { company_id } = request.user as any;
    const { new_plan_id } = changePlanSchema.parse(request.body);
    const service = new SubscriptionsService();
    
    const updatedSub = await service.changePlan(company_id, new_plan_id);
    return reply.send({ 
      message: 'Plano alterado com sucesso! Por favor, faça login novamente para atualizar suas permissões.', 
      subscription: updatedSub 
    });
  }

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    const { company_id } = request.user as any;
    const service = new SubscriptionsService();
    return reply.send(await service.cancelSubscription(company_id));
  }

  async webhook(request: FastifyRequest, reply: FastifyReply) {
    const body = billingWebhookSchema.parse(request.body);
    const service = new SubscriptionsService();
    return reply.send(await service.handleBillingWebhook(body));
  }
}