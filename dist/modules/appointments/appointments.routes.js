import { tenantMiddleware } from 'src/shared/middlewares/tenant.middleware';
export async function appointmentRoutes(app) {
    // Rota protegida pelo middleware
    app.get('/', { preHandler: [tenantMiddleware] }, async (request, reply) => {
        // A mágica: pegamos o banco do request. É 100% isolado da empresa do usuário logado!
        const db = request.tenantDb;
        // Busca os agendamentos na tabela isolada
        const appointments = await db.appointment.findMany({
            where: { date: { gte: new Date() } } // Ex: agendamentos futuros
        });
        return reply.send(appointments);
    });
}
