import type { FastifyRequest, FastifyReply } from 'fastify';
import { OrdersService } from './orders.service';
import { 
  createOrderSchema, updateOrderStatusSchema, cancelOrderSchema, 
  assignDeliverySchema, listOrdersSchema, calculateTotalSchema 
} from './orders.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Orders
// ─────────────────────────────────────────────────────────────

export async function listOrders(request: FastifyRequest, reply: FastifyReply) {
  const filters = listOrdersSchema.parse(request.query);
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.listOrders(filters));
}

export async function getOrder(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.getOrderById(id));
}

export async function createOrder(request: FastifyRequest, reply: FastifyReply) {
  const body = createOrderSchema.parse(request.body);
  const service = new OrdersService(request.businessDb);
  return reply.status(201).send(await service.createOrder(body));
}

export async function calculateOrderTotal(request: FastifyRequest, reply: FastifyReply) {
  const body = calculateTotalSchema.parse(request.body);
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.calculateOrderTotal(body));
}

export async function updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = updateOrderStatusSchema.parse(request.body);
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.updateOrderStatus(id, body.status));
}

export async function cancelOrder(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = cancelOrderSchema.parse(request.body);
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.cancelOrder(id, body.cancel_reason));
}

// ─── Proforma (Orçamento) ───

export async function createProforma(request: FastifyRequest, reply: FastifyReply) {
  // Simplificado para receber client_id e items
  const { client_id, items } = request.body as any; 
  const service = new OrdersService(request.businessDb);
  return reply.status(201).send(await service.createProforma(client_id, items));
}

export async function convertProforma(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.convertProformaToOrder(id));
}

// ─── Logística e Fila ───

export async function assignDelivery(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = assignDeliverySchema.parse(request.body);
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.assignDelivery(id, body.employee_id));
}

export async function estimateTime(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.estimateDeliveryTime(id));
}

export async function getQueueStatus(request: FastifyRequest, reply: FastifyReply) {
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.getQueueStatus());
}

// ─── Relatórios ───

export async function getDashboardSummary(request: FastifyRequest, reply: FastifyReply) {
  const { date } = request.query as { date?: string };
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.getDashboardSummary(date));
}

export async function generateDailyReport(request: FastifyRequest, reply: FastifyReply) {
  const { date } = request.params as { date: string };
  const service = new OrdersService(request.businessDb);
  return reply.status(200).send(await service.generateDailyReport(date));
}