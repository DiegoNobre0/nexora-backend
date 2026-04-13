import fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { z } from 'zod';
import socketio from 'fastify-socket.io';
import { Server } from 'socket.io';

// ── Master Module ──────────────────────────────────────────
import { authRoutes }             from './modules/master-module/auth/auth.routes';
import { companiesRoutes }        from './modules/master-module/companies/companies.routes';
import { usersRoutes }            from './modules/master-module/users/users.routes';
import { plansRoutes }            from './modules/master-module/plans/plans.routes';
import { whatsappWebhookRoutes }  from './modules/master-module/whatsappWebhook/whatsAppWebhook.routes';

// ── Business Module ────────────────────────────────────────
import { categoriesRoutes }   from './modules/business-module/categories/categories.routes';
import { productsRoutes }     from './modules/business-module/products/products.routes';
import { clientsRoutes }      from './modules/business-module/clients/clients.routes';
import { employeesRoutes }    from './modules/business-module/employees/employees.routes';
import { leadsRoutes }        from './modules/business-module/leads/leads.routes';
import { ordersRoutes }       from './modules/business-module/orders/orders.routes';
import { paymentsRoutes }     from './modules/business-module/payments/payments.routes';
import { cashRegisterRoutes } from './modules/business-module/cash-register/cash-register.routes';
import { taxesRoutes }        from './modules/business-module/taxes/taxes.routes';
import { deliveryRoutes }     from './modules/business-module/delivery/delivery.routes';
import { configsRoutes }      from './modules/business-module/configs/configs.routes';
import { AppError, UpgradeRequiredError } from './shared/errors/AppError';

// ──────────────────────────────────────────────────────────
export const app = fastify({ logger: true });

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

// ── Plugins ───────────────────────────────────────────────
app.register(socketio, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.register(cors, { origin: '*' });

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'super_secret_nexora_key_2026'
});

// ── Health check ──────────────────────────────────────────
app.get('/health', async () => ({
  status: 'ok',
  name: 'Nexora API',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

// ── Rotas Master (sem tenant) ─────────────────────────────
app.register(authRoutes,            { prefix: '/auth' });
app.register(companiesRoutes,       { prefix: '/companies' });
app.register(usersRoutes,           { prefix: '/users' });
app.register(plansRoutes,           { prefix: '/plans' });
app.register(whatsappWebhookRoutes, { prefix: '/whatsapp-webhook' });

// ── Rotas Business (com tenant via middleware) ─────────────
// Todas passam pelo businessMiddleware que resolve o DB correto
app.register(categoriesRoutes,   { prefix: '/categories' });
app.register(productsRoutes,     { prefix: '/products' });
app.register(clientsRoutes,      { prefix: '/clients' });
app.register(employeesRoutes,    { prefix: '/employees' });
app.register(leadsRoutes,        { prefix: '/leads' });
app.register(ordersRoutes,       { prefix: '/orders' });
app.register(paymentsRoutes,     { prefix: '/payments' });
app.register(cashRegisterRoutes, { prefix: '/cash-register' });
app.register(taxesRoutes,        { prefix: '/taxes' });
app.register(deliveryRoutes,     { prefix: '/delivery' });
app.register(configsRoutes,      { prefix: '/configs' });

// ── Tratamento global de erros ────────────────────────────
app.setErrorHandler((error, request, reply) => {
  // Zod — erro de validação
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      message: 'Erro de validação nos dados enviados.',
      errors: error.flatten().fieldErrors,
    });
  }
app.setErrorHandler((error, request, reply) => {
  // Zod
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      message: 'Erro de validação nos dados enviados.',
      errors: error.flatten().fieldErrors,
    });
  }

  // AppError (todos os erros customizados)
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
      ...(error instanceof UpgradeRequiredError && {
        feature: error.feature,
        upgrade_required: true,
      }),
    });
  }

  // JWT
  const fastifyError = error as FastifyError;
  if (fastifyError.code?.startsWith('FST_JWT')) {
    return reply.status(401).send({ message: 'Sessão inválida ou expirada.' });
  }

  request.log.error(error);
  return reply.status(500).send({
    message: 'Erro interno do servidor. Tente novamente mais tarde.',
  });
});

  // Erro genérico — loga internamente, não expõe detalhes
  request.log.error(error);
  return reply.status(500).send({
    message: 'Erro interno do servidor. Tente novamente mais tarde.',
  });
});