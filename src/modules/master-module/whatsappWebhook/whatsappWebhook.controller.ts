import type { FastifyRequest, FastifyReply } from 'fastify';
import { WhatsAppWebhookService } from './whatsAppWebhook.service';


const whatsAppWebhookService = new WhatsAppWebhookService();

export class WhatsAppWebhookController {
  async verify(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const challenge = whatsAppWebhookService.verifyToken(
        query['hub.mode'],
        query['hub.verify_token'],
        query['hub.challenge']
      );
      return reply.status(200).send(challenge);
    } catch (error) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  }

  async handle(request: FastifyRequest, reply: FastifyReply) {
    // Processamos em background mas respondemos 200 imediatamente para a Meta
    whatsAppWebhookService.processWebhook(request.body).catch(err => {
      console.error('[Webhook Error]:', err);
    });

    return reply.status(200).send({ status: 'RECEIVED' });
  }
}