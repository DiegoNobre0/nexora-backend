import type { FastifyInstance } from 'fastify';
import { WhatsAppWebhookController } from './whatsappWebhook.controller';

const controller = new WhatsAppWebhookController();

// IMPORTANTE: Esta rota deve ser pública (SEM o `businessMiddleware`)
// pois a Meta não envia nosso JWT, ela envia a própria assinatura.
export async function whatsappWebhookRoutes(app: FastifyInstance) {
  
  // Para que a validação de assinatura da Meta funcione com precisão cirúrgica,
  // precisamos dizer ao Fastify para não destruir o RAW BODY nesta rota específica.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
      const json = JSON.parse(body as string);
      // Injetamos o rawBody no request para podermos usá-lo no Controller
      (req as any).rawBody = body;
      done(null, json);
    } catch (err : any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  app.get('/', controller.verify.bind(controller));
  app.post('/', controller.handle.bind(controller));
}