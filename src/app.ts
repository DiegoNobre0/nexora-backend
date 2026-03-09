import fastify from 'fastify';
import cors from '@fastify/cors';

export const app = fastify({
  logger: true, // Excelente para debug no desenvolvimento
});

// Registra plugins básicos
app.register(cors, {
  origin: '*', // Ajustaremos isso depois para o domínio do painel Angular
});

// Rota de Healthcheck para testar se a API está de pé
app.get('/health', async () => {
  return { status: 'ok', name: 'Nexora API', version: '1.0.0' };
});

// Aqui no futuro registraremos as rotas dos módulos:
// app.register(authRoutes, { prefix: '/auth' })
// app.register(companyRoutes, { prefix: '/companies' })