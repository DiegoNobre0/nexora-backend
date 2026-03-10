import type { FastifyInstance } from 'fastify';
import { WhatsAppWebhookController } from '../master-module/whatsappWebhook/whatsappWebhook.controller';


const whatsAppWebhookController = new WhatsAppWebhookController();

export async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.get('/whatsapp', whatsAppWebhookController.verify);
  app.post('/whatsapp', whatsAppWebhookController.handle);
}