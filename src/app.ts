import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { employeesRoutes } from './modules/tenant/employees/employees.routes';
import { clientsRoutes } from './modules/tenant/clients/clients.routes';
import { servicesRoutes } from './modules/tenant/services/services.routes';
import { appointmentRoutes } from './modules/appointments/appointments.routes';

export const app = fastify({
  logger: true, 
});

// Registra os plugins
app.register(cors, { origin: '*' });

// Registra o JWT com uma chave secreta (Em produção, coloque no .env!)
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'super_secret_nexora_key_2026'
});

// Rota de Healthcheck
app.get('/health', async () => {
  return { status: 'ok', name: 'Nexora API', version: '1.0.0' };
});

// Registra as rotas de Autenticação
app.register(authRoutes, { prefix: '/auth' });
app.register(usersRoutes, { prefix: '/users' });
app.register(employeesRoutes, { prefix: '/employees' });
app.register(clientsRoutes, { prefix: '/clients' });
app.register(servicesRoutes, { prefix: '/services' });
app.register(appointmentRoutes, { prefix: '/appointments' });