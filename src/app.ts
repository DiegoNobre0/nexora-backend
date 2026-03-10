import fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { z } from 'zod'; // 👈 Faltava essa importação aqui!

// Imports das rotas (Certifique-se que os caminhos batem com as suas pastas atuais)

import { employeesRoutes } from './modules/business-module/employees/employees.routes';
import { clientsRoutes } from './modules/business-module/clients/clients.routes';
import { servicesRoutes } from './modules/business-module/services/services.routes';
import { appointmentRoutes, calendarRoutes } from './modules/business-module/calendar/calendar.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';

export const app = fastify({
  logger: true, 
});

// Configuração do CORS para o Angular (localhost:4200) conseguir acessar
app.register(cors, { origin: '*' });

// Registra o JWT
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'super_secret_nexora_key_2026'
});

// Rota de Healthcheck
app.get('/health', async () => {
  return { status: 'ok', name: 'Nexora API', version: '1.0.0' };
});

// Registro das rotas com seus respectivos prefixos
app.register(authRoutes, { prefix: '/auth' });
app.register(usersRoutes, { prefix: '/users' });
app.register(employeesRoutes, { prefix: '/employees' });
app.register(clientsRoutes, { prefix: '/clients' });
app.register(servicesRoutes, { prefix: '/services' });
app.register(calendarRoutes, { prefix: '/calendar' });

// --- TRATAMENTO GLOBAL DE ERROS ---

app.setErrorHandler((error, request, reply) => {
  // Captura erros de validação do Zod em qualquer lugar do sistema
  if (error instanceof z.ZodError) {
    return reply.status(400).send({ 
      message: 'Erro de validação nos dados enviados.', 
      errors: error.flatten().fieldErrors 
    });
  }

  const fastifyError = error as FastifyError;

  // Se for um erro de JWT (token inválido/expirado)
  if (fastifyError.code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE' || 
      fastifyError.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    return reply.status(401).send({ message: 'Token de acesso inválido ou ausente.' });
  }
  
  // Loga o erro real no console para você debugar, mas não mostra pro cliente
  request.log.error(error); 
  
  return reply.status(500).send({ 
    message: 'Erro interno do servidor. Tente novamente mais tarde.' 
  });
});