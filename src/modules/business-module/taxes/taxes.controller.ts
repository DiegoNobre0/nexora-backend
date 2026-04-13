import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaxesService } from './taxes.service';
import { createTaxSchema, updateTaxSchema, listTaxesSchema, calculateFeeSchema } from './taxes.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Taxes
//
// Apenas valida entrada e delega para o service.
// ─────────────────────────────────────────────────────────────

// GET /taxes
export async function listTaxes(request: FastifyRequest, reply: FastifyReply) {
  const filters = listTaxesSchema.parse(request.query);
  const service = new TaxesService(request.businessDb);
  return reply.status(200).send(await service.list(filters));
}

// GET /taxes/:id
export async function getTax(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new TaxesService(request.businessDb);
  return reply.status(200).send(await service.findById(id));
}

// POST /taxes
export async function createTax(request: FastifyRequest, reply: FastifyReply) {
  const body    = createTaxSchema.parse(request.body);
  const service = new TaxesService(request.businessDb);
  return reply.status(201).send(await service.create(body));
}

// PUT /taxes/:id
export async function updateTax(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = updateTaxSchema.parse(request.body);
  const service = new TaxesService(request.businessDb);
  return reply.status(200).send(await service.update(id, body));
}

// DELETE /taxes/:id
export async function deleteTax(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new TaxesService(request.businessDb);
  return reply.status(200).send(await service.delete(id));
}

// POST /taxes/calculate
// Calcula a taxa e o valor líquido para um pagamento específico
export async function calculateFee(request: FastifyRequest, reply: FastifyReply) {
  const body    = calculateFeeSchema.parse(request.body);
  const service = new TaxesService(request.businessDb);
  return reply.status(200).send(await service.calculateFee(body));
}