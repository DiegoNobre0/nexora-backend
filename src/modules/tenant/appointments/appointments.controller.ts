import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppointmentsService } from './appointments.service';

const appointmentsService = new AppointmentsService();

export class AppointmentsController {
  async handleCreate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const appointment = await appointmentsService.create(request.tenantDb, request.body);
      return reply.status(201).send(appointment);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  async handleList(request: FastifyRequest, reply: FastifyReply) {
    const { date } = request.query as { date?: string };
    const appointments = await appointmentsService.list(request.tenantDb, date);
    return reply.send(appointments);
  }

  async handleStatusUpdate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const appointment = await appointmentsService.updateStatus(request.tenantDb, id, status);
    return reply.send(appointment);
  }
}