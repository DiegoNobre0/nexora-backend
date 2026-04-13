import type { FastifyRequest, FastifyReply } from 'fastify';

// Middleware base para rotas autenticadas do painel (Master DB)
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Token de acesso ausente.' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = await request.server.jwt.verify(token);
    
    // Injeta os dados decodificados no request nativo do Fastify
    request.user = decoded;
  } catch (error) {
    return reply.status(401).send({ message: 'Sessão inválida ou expirada.' });
  }
}

// Guard de Autorização por Role
export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Garante que o usuário foi autenticado primeiro
    if (!request.user) await authMiddleware(request, reply);
    
    const user = request.user as any;
    
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ 
        message: 'Acesso negado. Você não tem permissão para realizar esta ação.' 
      });
    }
  };
}