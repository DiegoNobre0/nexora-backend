import type { FastifyRequest, FastifyReply } from 'fastify';
import { EmployeesService } from './employees.service';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema } from './employees.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Employees
//
// Apenas valida entrada e delega para o service.
// ─────────────────────────────────────────────────────────────

// GET /employees
export async function listEmployees(request: FastifyRequest, reply: FastifyReply) {
  const filters = listEmployeesSchema.parse(request.query);
  const service = new EmployeesService(request.businessDb);
  return reply.status(200).send(await service.list(filters));
}

// GET /employees/:id
export async function getEmployee(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new EmployeesService(request.businessDb);
  return reply.status(200).send(await service.findById(id));
}

// POST /employees
export async function createEmployee(request: FastifyRequest, reply: FastifyReply) {
  const body    = createEmployeeSchema.parse(request.body);
  const service = new EmployeesService(request.businessDb);
  return reply.status(201).send(await service.create(body));
}

// PUT /employees/:id
export async function updateEmployee(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = updateEmployeeSchema.parse(request.body);
  const service = new EmployeesService(request.businessDb);
  return reply.status(200).send(await service.update(id, body));
}

// DELETE /employees/:id
export async function deleteEmployee(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new EmployeesService(request.businessDb);
  return reply.status(200).send(await service.delete(id));
}

// PATCH /employees/:id/toggle
export async function toggleEmployee(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new EmployeesService(request.businessDb);
  return reply.status(200).send(await service.toggle(id));
}