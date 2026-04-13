import type { FastifyRequest, FastifyReply } from 'fastify';
import { OrderService } from './orders.service';

const orderService = new OrderService();

export class OrderController {
  async handleCreate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const order = await orderService.create(request.businessDb, request.body);
      return reply.status(201).send(order);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

async handleList(request: FastifyRequest, reply: FastifyReply) {
  // 1. Pegamos tanto date quanto month da query string
  const { date, month } = request.query as { date?: string, month?: string };

  // 2. Passamos como um objeto para o Service (Isso resolve o erro de tipo!)
  const orders = await orderService.list(request.businessDb, { 
    date, 
    month 
  });

  return reply.send(orders);
}

  async handleStatusUpdate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const order  = await orderService.updateStatus(request.businessDb, id, status);
    return reply.send(order);
  }

// No order.controller.ts

async handleAvailability(request: FastifyRequest, reply: FastifyReply) {
  const { employee_id, date } = request.query as { employee_id: string; date: string };

  if (!employee_id || !date) {
    return reply.status(400).send({ error: 'employee_id e date são obrigatórios.' });
  }

  const availability = await orderService.getAvailability(
    request.businessDb, 
    employee_id, 
    date
  );

  return reply.send(availability);
}
  
}