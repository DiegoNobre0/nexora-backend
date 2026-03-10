import { EmployeesService } from './employees.service';
const employeesService = new EmployeesService();
export class EmployeesController {
    async create(request, reply) {
        const db = request.tenantDb;
        const employee = await employeesService.create(db, request.body);
        return reply.status(201).send(employee);
    }
    async list(request, reply) {
        const db = request.tenantDb;
        const employees = await employeesService.listAll(db);
        return reply.send(employees);
    }
    async getById(request, reply) {
        const { id } = request.params;
        const db = request.tenantDb;
        const employee = await employeesService.findById(db, id);
        if (!employee)
            return reply.status(404).send({ error: 'Profissional não encontrado' });
        return reply.send(employee);
    }
    async update(request, reply) {
        const { id } = request.params;
        const db = request.tenantDb;
        const employee = await employeesService.update(db, id, request.body);
        return reply.send(employee);
    }
    async delete(request, reply) {
        const { id } = request.params;
        const db = request.tenantDb;
        await employeesService.delete(db, id);
        return reply.status(204).send(); // 204 No Content
    }
}
