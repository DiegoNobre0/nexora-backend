import type { FastifyRequest, FastifyReply } from 'fastify';
import { getBusinessClient } from '../../database/business-manager';
import { masterDb } from '../../database/master';

// ── Tipagem do payload do JWT ──────────────────────────────
interface JwtPayload {
  sub: string              // user id
  company_id: string
  business_db_name: string
  role: string
  plan_features: Record<string, unknown>
}

// ── Extensão do FastifyRequest ─────────────────────────────
declare module 'fastify' {
  interface FastifyRequest {
    businessDb: ReturnType<typeof getBusinessClient>
    jwtPayload: JwtPayload
  }
}

// ── Middleware principal ───────────────────────────────────
export async function businessMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Token de acesso ausente.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await request.server.jwt.verify<JwtPayload>(token);

    if (!decoded.business_db_name) {
      return reply.status(403).send({ message: 'Empresa não identificada no token.' });
    }

    if (!decoded.company_id) {
      return reply.status(403).send({ message: 'Empresa inválida no token.' });
    }

    // Verifica se a empresa ainda está ativa no master
    const company = await masterDb.company.findUnique({
      where: { id: decoded.company_id },
      select: { is_active: true }
    });

    if (!company?.is_active) {
      return reply.status(403).send({ message: 'Empresa inativa ou suspensa.' });
    }

    // Injeta o client do banco da empresa e o payload no request
    request.businessDb  = getBusinessClient(decoded.business_db_name);
    request.jwtPayload  = decoded;

  } catch (error) {
    return reply.status(401).send({ message: 'Sessão inválida ou expirada.' });
  }
}

// ── Helper: verifica feature do plano ─────────────────────
// Uso nos controllers: checkPlanFeature(request, reply, 'bot_ai')
export async function checkPlanFeature(
  request: FastifyRequest,
  reply: FastifyReply,
  feature: string
): Promise<boolean> {
  const features = request.jwtPayload?.plan_features;

  if (!features) {
    reply.status(403).send({ message: 'Plano não identificado.' });
    return false;
  }

  const value = features[feature];

  // false ou 0 = bloqueado
  if (value === false || value === 0) {
    reply.status(403).send({
      message: `Seu plano não inclui acesso a este recurso (${feature}). Faça upgrade para continuar.`,
      feature,
      upgrade_required: true,
    });
    return false;
  }

  return true;
}

// ── Helper: verifica limite numérico do plano ──────────────
// Uso: checkPlanLimit(request, reply, 'max_products', currentCount)
export async function checkPlanLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  limitKey: string,
  currentCount: number
): Promise<boolean> {
  const features = request.jwtPayload?.plan_features;
  const limit = features?.[limitKey] as number;

  if (limit === undefined) return true; // sem limite definido = libera
  if (limit === -1) return true;        // -1 = ilimitado

  if (currentCount >= limit) {
    reply.status(403).send({
      message: `Limite atingido: seu plano permite até ${limit} itens para "${limitKey}". Faça upgrade para continuar.`,
      limit_key: limitKey,
      limit,
      current: currentCount,
      upgrade_required: true,
    });
    return false;
  }

  return true;
}