import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigsService } from './configs.service';
import { updateConfigSchema } from './configs.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Configs
// ─────────────────────────────────────────────────────────────

// GET /configs
export async function getConfig(request: FastifyRequest, reply: FastifyReply) {
  const service = new ConfigsService(request.businessDb);
  return reply.status(200).send(await service.getConfig());
}

// PUT /configs
// Como há apenas 1 config por loja, não precisamos passar o :id na URL
export async function updateConfig(request: FastifyRequest, reply: FastifyReply) {
  const body    = updateConfigSchema.parse(request.body);
  const service = new ConfigsService(request.businessDb);
  return reply.status(200).send(await service.updateConfig(body));
}

// GET /configs/status
// Retorna se a loja está aberta ou fechada no exato momento (baseado em horários e feriados)
export async function getStatus(request: FastifyRequest, reply: FastifyReply) {
  const service = new ConfigsService(request.businessDb);
  return reply.status(200).send(await service.getCurrentStatus());
}