// Exemplo solto de como ficaria em src/modules/appointments/appointments.routes.ts
import { FastifyInstance } from 'fastify';
import { businessMiddleware } from 'src/shared/middlewares/business.middleware';


export async function appointmentRoutes(app: FastifyInstance) {
  
  // Rota protegida pelo middleware
  app.get('/', { preHandler: [businessMiddleware] }, async (request, reply) => {
    
    // A mágica: pegamos o banco do request. É 100% isolado da empresa do usuário logado!
    const db = request.businessDb; 

    // Busca os agendamentos na tabela isolada
    const appointments = await db.appointment.findMany({
      where: { date: { gte: new Date() } } // Ex: agendamentos futuros
    });

    return reply.send(appointments);
  });
}