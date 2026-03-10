import type { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', authController.register);
  app.post('/login', authController.login);
}