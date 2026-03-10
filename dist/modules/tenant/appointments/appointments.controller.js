import { AppointmentsService } from './appointments.service';
const appointmentsService = new AppointmentsService();
export class AppointmentsController {
    async handleCreate(request, reply) {
        try {
            const appointment = await appointmentsService.create(request.tenantDb, request.body);
            return reply.status(201).send(appointment);
        }
        catch (error) {
            return reply.status(400).send({ error: error.message });
        }
    }
    async handleList(request, reply) {
        const { date } = request.query;
        const appointments = await appointmentsService.list(request.tenantDb, date);
        return reply.send(appointments);
    }
    async handleStatusUpdate(request, reply) {
        const { id } = request.params;
        const { status } = request.body;
        const appointment = await appointmentsService.updateStatus(request.tenantDb, id, status);
        return reply.send(appointment);
    }
}
