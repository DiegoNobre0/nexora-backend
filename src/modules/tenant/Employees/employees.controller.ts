import type { FastifyRequest, FastifyReply } from 'fastify';
import { EmployeesService } from './employees.service';

const employeesService = new EmployeesService();

export class EmployeesController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const db = request.tenantDb; 
    const employee = await employeesService.create(db, request.body as any);
    return reply.status(201).send(employee);
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const db = request.tenantDb;
    const employees = await employeesService.listAll(db);
    return reply.send(employees);
  }
}