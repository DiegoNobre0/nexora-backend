import type { FastifyRequest, FastifyReply } from 'fastify';
import { EmployeesService } from './employees.service';


const employeesService = new EmployeesService();

export class EmployeesController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const db = request.businessDb; 
    const employee = await employeesService.create(db, request.body as any);
    return reply.status(201).send(employee);
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const db = request.businessDb;
    const employees = await employeesService.listAll(db);
    return reply.send(employees);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const db = request.businessDb;
    const employee = await employeesService.findById(db, id);
    
    if (!employee) return reply.status(404).send({ error: 'Profissional não encontrado' });
    return reply.send(employee);
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const db = request.businessDb;
    const employee = await employeesService.update(db, id, request.body as any);
    return reply.send(employee);
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const db = request.businessDb;
    await employeesService.delete(db, id);
    return reply.status(204).send(); // 204 No Content
  }
}