import { FastifyRequest, FastifyReply } from 'fastify';
import { getTenantClient } from '../../database/tenant-manager';

// Precisamos avisar ao TypeScript que o request do Fastify vai receber uma propriedade nova
declare module 'fastify' {
  interface FastifyRequest {
    tenantDb: any; // O ideal é tipar com o PrismaClient do Tenant gerado futuramente
  }
}

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Pega o token de autorização que o Angular enviou no header
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return reply.status(401).send({ error: 'Token de acesso ausente.' });
    }

    // 2. Extrai e decodifica o JWT (Usaremos o @fastify/jwt na prática)
    // const token = authHeader.replace('Bearer ', '');
    // const decoded = await request.jwtVerify(token);
    
    // Simulação do que estaria dentro do JWT após o login do usuário:
    const decoded = { 
      user_id: '123-uuid', 
      tenant_db_name: 'db_tenant_barbearia_ze' // A informação de ouro!
    } as any; 

    if (!decoded.tenant_db_name) {
      return reply.status(403).send({ error: 'Empresa não identificada no token.' });
    }

    // 3. Pega a conexão do banco isolado daquela barbearia
    const db = getTenantClient(decoded.tenant_db_name);

    // 4. Injeta a conexão diretamente no request
    request.tenantDb = db;

  } catch (error) {
    return reply.status(401).send({ error: 'Sessão inválida ou expirada.' });
  }
}