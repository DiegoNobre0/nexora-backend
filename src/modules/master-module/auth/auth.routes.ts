import type { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  // O Fastify lida com POST /auth/register (pois o prefixo /auth está no app.ts)
  app.post('/register', authController.register);
  app.post('/login', authController.login);
}