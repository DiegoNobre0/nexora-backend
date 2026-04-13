import type { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentsService } from './payments.service';
import { 
  createIntentSchema, generateBoletoSchema, refundPaymentSchema, webhookSchema 
} from './payments.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Payments
// ─────────────────────────────────────────────────────────────

export async function createIntent(request: FastifyRequest, reply: FastifyReply) {
  const body = createIntentSchema.parse(request.body);
  const service = new PaymentsService(request.businessDb);
  return reply.status(201).send(await service.createPaymentIntent(body));
}

export async function generatePix(request: FastifyRequest, reply: FastifyReply) {
  const { order_id, amount } = request.body as { order_id: string; amount: number };
  const service = new PaymentsService(request.businessDb);
  return reply.status(201).send(await service.generatePixQRCode(order_id, amount));
}

export async function generateBoleto(request: FastifyRequest, reply: FastifyReply) {
  const body = generateBoletoSchema.parse(request.body);
  const service = new PaymentsService(request.businessDb);
  return reply.status(201).send(await service.generateBoleto(body));
}

export async function getBoletoStatus(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new PaymentsService(request.businessDb);
  return reply.status(200).send(await service.getBoletoStatus(id));
}

export async function cancelBoleto(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new PaymentsService(request.businessDb);
  return reply.status(200).send(await service.cancelBoleto(id));
}

export async function reissueBoleto(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { due_date } = request.body as { due_date: string };
  const service = new PaymentsService(request.businessDb);
  return reply.status(200).send(await service.reissueBoleto(id, due_date));
}

export async function refundPayment(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = refundPaymentSchema.parse(request.body);
  const service = new PaymentsService(request.businessDb);
  return reply.status(200).send(await service.issueRefund(id, body));
}

export async function getReceipt(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new PaymentsService(request.businessDb);
  return reply.status(200).send(await service.generateReceipt(id));
}

// ⚠️ Esta rota idealmente seria pública sem JWT para o gateway conseguir bater nela.
// Para gateways modernos, geralmente passamos o token JWT na própria URL do webhook
// ou configuramos uma secret header.
export async function webhookHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = webhookSchema.parse(request.body);
  const service = new PaymentsService(request.businessDb);
  return reply.status(200).send(await service.confirmPayment(body));
}