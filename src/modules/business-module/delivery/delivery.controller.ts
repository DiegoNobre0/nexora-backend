import type { FastifyRequest, FastifyReply } from 'fastify';
import { DeliveryService } from './delivery.service';
import { 
  createDeliveryZoneSchema, 
  updateDeliveryZoneSchema, 
  listDeliveryZonesSchema, 
  calculateDeliverySchema 
} from './delivery.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Delivery
// ─────────────────────────────────────────────────────────────

// GET /delivery
export async function listDeliveryZones(request: FastifyRequest, reply: FastifyReply) {
  const filters = listDeliveryZonesSchema.parse(request.query);
  const service = new DeliveryService(request.businessDb);
  return reply.status(200).send(await service.list(filters));
}

// GET /delivery/:id
export async function getDeliveryZone(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new DeliveryService(request.businessDb);
  return reply.status(200).send(await service.findById(id));
}

// POST /delivery
export async function createDeliveryZone(request: FastifyRequest, reply: FastifyReply) {
  const body    = createDeliveryZoneSchema.parse(request.body);
  const service = new DeliveryService(request.businessDb);
  return reply.status(201).send(await service.create(body));
}

// PUT /delivery/:id
export async function updateDeliveryZone(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = updateDeliveryZoneSchema.parse(request.body);
  const service = new DeliveryService(request.businessDb);
  return reply.status(200).send(await service.update(id, body));
}

// DELETE /delivery/:id
export async function deleteDeliveryZone(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new DeliveryService(request.businessDb);
  return reply.status(200).send(await service.delete(id));
}

// POST /delivery/calculate
// Motor inteligente para determinar o valor do frete antes de fechar o pedido
export async function calculateDeliveryFee(request: FastifyRequest, reply: FastifyReply) {
  const body    = calculateDeliverySchema.parse(request.body);
  const service = new DeliveryService(request.businessDb);
  return reply.status(200).send(await service.calculateFee(body));
}