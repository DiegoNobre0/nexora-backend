import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';

const authService = new AuthService();

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await authService.register(request.body);
      return reply.send({ message: 'Empresa criada com sucesso!', company: result.company });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = request.body as any;
    
    const user = await authService.validateLogin(email, password);
    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' });
    }

    const token = request.server.jwt.sign({
      sub: user.id,
      company_id: user.company_id,
      tenant_db_name: user.company.tenant_db_name,
      role: user.role
    }, { expiresIn: '1d' });

    return reply.send({ token, user: { name: user.name, email: user.email, company: user.company.name } });
  }
}