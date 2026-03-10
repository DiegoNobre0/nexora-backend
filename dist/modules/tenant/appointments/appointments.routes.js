import { AppointmentsController } from './appointments.controller';
import { tenantMiddleware } from '../../../shared/middlewares/tenant.middleware';
const appointmentsController = new AppointmentsController();
export async function appointmentRoutes(app) {
    app.addHook('preHandler', tenantMiddleware);
    app.post('/', appointmentsController.handleCreate);
    app.get('/', appointmentsController.handleList); // Aceita ?date=YYYY-MM-DD
    app.patch('/:id/status', appointmentsController.handleStatusUpdate);
}
