import type { FastifyRequest, FastifyReply } from 'fastify';
import { getBusinessClient } from '../../database/business-manager';

declare module 'fastify' {
  interface FastifyRequest {
    businessDb: any; 
  }
}

export async function businessMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return reply.status(401).send({ error: 'Token de acesso ausente.' });
    }

    // 1. Limpa o texto "Bearer " para pegar só o código do token
    const token = authHeader.replace('Bearer ', '');
    
    // 2. O Fastify verifica se a assinatura é válida e decodifica os dados
    const decoded = await request.server.jwt.verify<{ business_db_name: string }>(token);

    if (!decoded.business_db_name) {
      return reply.status(403).send({ error: 'Empresa não identificada no token.' });
    }

    // 3. Conecta no banco correto e injeta no request
    const db = getBusinessClient(decoded.business_db_name);
    request.businessDb = db;

  } catch (error) {
    return reply.status(401).send({ error: 'Sessão inválida ou expirada.' });
  }
}