import fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { z } from 'zod';
import socketio from 'fastify-socket.io';
import { Server } from 'socket.io';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import * as Sentry from "@sentry/node"; // 1. Importa o Sentry
import multipart from '@fastify/multipart';

// ── Master Module ──────────────────────────────────────────
import { authRoutes } from './modules/master-module/auth/auth.routes';
import { companiesRoutes } from './modules/master-module/companies/companies.routes';
import { usersRoutes } from './modules/master-module/users/users.routes';
import { plansRoutes } from './modules/master-module/plans/plans.routes';
import { subscriptionsRoutes } from './modules/master-module/subscriptions/subscriptions.routes';
import { whatsappWebhookRoutes } from './modules/master-module/whatsappWebhook/whatsAppWebhook.routes';

// ── Business Module ────────────────────────────────────────
import { categoriesRoutes } from './modules/business-module/categories/categories.routes';
import { productsRoutes } from './modules/business-module/products/products.routes';
import { clientsRoutes } from './modules/business-module/clients/clients.routes';
import { employeesRoutes } from './modules/business-module/employees/employees.routes';
import { leadsRoutes } from './modules/business-module/leads/leads.routes';
import { ordersRoutes } from './modules/business-module/orders/orders.routes';
import { paymentsRoutes } from './modules/business-module/payments/payments.routes';
import { cashRegisterRoutes } from './modules/business-module/cash-register/cash-register.routes';
import { taxesRoutes } from './modules/business-module/taxes/taxes.routes';
import { deliveryRoutes } from './modules/business-module/delivery/delivery.routes';
import { configsRoutes } from './modules/business-module/configs/configs.routes';
import { analyticsRoutes } from './modules/business-module/analytics/analytics.routes';

import { AppError, UpgradeRequiredError } from './shared/errors/AppError';
import { masterDb } from './database/master';
import { promoKitsRoutes } from './modules/business-module/promoKits/promo-kits.routes';

// 2. Inicializa o Sentry antes de criar o app (Essencial para produção)
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

export const app = fastify({ logger: true });

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

// ── REGISTRO DE PLUGINS (Ordem importa!) ───────────────────

// Swagger primeiro para mapear as rotas
app.register(swagger, {
  openapi: {
    info: { title: 'Nexora API', version: '1.0.0', description: 'Documentação do ecossistema Nexora' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  }
});

app.register(swaggerUi, { routePrefix: '/docs' });

app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Vá com calma! Você só pode fazer ${context.max} requisições por minuto.`
  })
});

app.register(socketio, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }
});

app.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'super_secret_nexora_key_2026'
});


app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB por segurança
  }
});

// ── ROTAS ──────────────────────────────────────────────────

// Rota de Healthcheck
app.get('/health', async (request, reply) => {
  const dbStatus = await masterDb.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down');
  return {
    status: 'ok',
    uptime: process.uptime(),
    db: dbStatus,
    timestamp: new Date().toISOString()
  };
});


// Master Routes
app.register(authRoutes, { prefix: '/auth' });
app.register(companiesRoutes, { prefix: '/companies' });
app.register(usersRoutes, { prefix: '/users' });
app.register(plansRoutes, { prefix: '/plans' });
app.register(subscriptionsRoutes, { prefix: '/subscriptions' });
app.register(whatsappWebhookRoutes, { prefix: '/whatsapp-webhook' });

// Business Routes
app.register(categoriesRoutes, { prefix: '/categories' });
app.register(productsRoutes, { prefix: '/products' });
app.register(clientsRoutes, { prefix: '/clients' });
app.register(employeesRoutes, { prefix: '/employees' });
app.register(leadsRoutes, { prefix: '/leads' });
app.register(ordersRoutes, { prefix: '/orders' });
app.register(paymentsRoutes, { prefix: '/payments' });
app.register(cashRegisterRoutes, { prefix: '/cash-register' });
app.register(taxesRoutes, { prefix: '/taxes' });
app.register(deliveryRoutes, { prefix: '/delivery' });
app.register(configsRoutes, { prefix: '/configs' });
app.register(analyticsRoutes, { prefix: '/analytics' });
app.register(promoKitsRoutes, { prefix: '/promo-kits' });

// ── TRATAMENTO GLOBAL DE ERROS (Consolidado) ───────────────

app.setErrorHandler((error, request, reply) => {
  // Erro de Validação (Zod)
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      message: 'Erro de validação nos dados enviados.',
      errors: error.flatten().fieldErrors,
    });
  }

  // Erros customizados da aplicação (AppError)
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

  // Erros de JWT (Não autorizado)
  const fastifyError = error as FastifyError;
  if (fastifyError.code?.startsWith('FST_JWT') || fastifyError.statusCode === 401) {
    return reply.status(401).send({ message: 'Sessão inválida ou expirada.' });
  }

  // Erros 500 (Críticos) -> Manda pro Sentry e Loga
  request.log.error(error);

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error);
  }

  return reply.status(500).send({
    message: 'Erro interno do servidor. Tente novamente mais tarde.',
  });
});