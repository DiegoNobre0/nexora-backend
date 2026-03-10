import { ClientsController } from './clients.controller';
import { tenantMiddleware } from '../../../shared/middlewares/tenant.middleware';
const clientsController = new ClientsController();
export async function clientsRoutes(app) {
    app.addHook('preHandler', tenantMiddleware);
    app.post('/', clientsController.handleCreate);
    app.get('/', clientsController.handleList);
    // Rotas específicas por ID
    app.get('/:id', clientsController.handleGetById);
    app.patch('/:id', clientsController.handleUpdate);
    app.delete('/:id', clientsController.handleDelete);
}
