import type { FastifyRequest, FastifyReply } from 'fastify';
import { CashRegisterService } from './cash-register.service';
import { 
  openRegisterSchema, closeRegisterSchema, movementSchema, manualEntrySchema 
} from './cash-register.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Cash Register
// ─────────────────────────────────────────────────────────────

export async function getOpenRegister(request: FastifyRequest, reply: FastifyReply) {
  const { employeeId } = request.params as { employeeId: string };
  const service = new CashRegisterService(request.businessDb);
  const register = await service.getOpenRegister(employeeId);
  // Pode retornar 204 No Content se não houver caixa aberto
  if (!register) return reply.status(204).send();
  return reply.status(200).send(register);
}

export async function openCashRegister(request: FastifyRequest, reply: FastifyReply) {
  const body = openRegisterSchema.parse(request.body);
  const service = new CashRegisterService(request.businessDb);
  return reply.status(201).send(await service.openCashRegister(body));
}

export async function closeCashRegister(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = closeRegisterSchema.parse(request.body);
  const service = new CashRegisterService(request.businessDb);
  return reply.status(200).send(await service.closeCashRegister(id, body));
}

// ─── Movimentações Manuais ───

export async function registerWithdrawal(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = movementSchema.parse(request.body);
  const service = new CashRegisterService(request.businessDb);
  return reply.status(201).send(await service.registerWithdrawal(id, body));
}

export async function registerSupply(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = movementSchema.parse(request.body);
  const service = new CashRegisterService(request.businessDb);
  return reply.status(201).send(await service.registerSupply(id, body));
}

export async function registerManualEntry(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = manualEntrySchema.parse(request.body);
  const service = new CashRegisterService(request.businessDb);
  return reply.status(201).send(await service.registerManualEntry(id, body));
}

// ─── Relatórios ───

export async function getCashRegisterSummary(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new CashRegisterService(request.businessDb);
  return reply.status(200).send(await service.getCashRegisterSummary(id));
}

export async function listMovements(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new CashRegisterService(request.businessDb);
  return reply.status(200).send(await service.listMovements(id));
}

export async function generateClosingReport(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new CashRegisterService(request.businessDb);
  return reply.status(200).send(await service.generateClosingReport(id));
}