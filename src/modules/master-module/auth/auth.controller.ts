import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { CompaniesService } from '../companies/companies.service';

const authService = new AuthService();
const companiesService = new CompaniesService();

export class AuthController {
  // O endpoint público /register apenas repassa para o CompaniesService
  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await companiesService.create(request.body as any);
      return reply.status(201).send({ message: 'Conta criada com sucesso!', company: result.company });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, password } = request.body as any;
      
      const user = await authService.validateLogin(email, password);
      if (!user) {
        return reply.status(401).send({ error: 'Credenciais inválidas.' });
      }

      // Extrai as features do plano (se houver assinatura)
      const currentSub = user.company.subscriptions[0];
      const planFeatures = currentSub?.plan?.features || {};

      // Payload Tipado (Bate exatamente com o que o business.middleware espera!)
      const payload = {
        sub: user.id,
        company_id: user.company_id,
        business_db_name: user.company.business_db_name,
        role: user.role,
        plan_features: planFeatures
      };

      const token = request.server.jwt.sign(payload, { expiresIn: '1d' });
      
      // Opcional: Refresh Token (Dura 7 dias)
      const refreshToken = request.server.jwt.sign(payload, { expiresIn: '7d' });

      return reply.send({ 
        token, 
        refresh_token: refreshToken,
        user: { 
          id: user.id,
          name: user.name, 
          email: user.email, 
          role: user.role,
          company: user.company.name 
        } 
      });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }
}