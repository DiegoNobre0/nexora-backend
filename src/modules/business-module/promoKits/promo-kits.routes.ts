import { FastifyInstance } from 'fastify';
import { createPromoKit, listPromoKits, deletePromoKit, updatePromoKit } from './promo-kits.controller';
import { businessMiddleware } from 'src/shared/middlewares/business.middleware';

export async function promoKitsRoutes(app: FastifyInstance) {
   app.addHook('preHandler', businessMiddleware);
  app.post('/', createPromoKit);
  app.get('/', listPromoKits);
  app.put('/:id', updatePromoKit);
  app.delete('/:id', deletePromoKit);
}