import { ClientsService } from './clients.service';
const clientsService = new ClientsService();
export class ClientsController {
    async handleCreate(request, reply) {
        const client = await clientsService.create(request.tenantDb, request.body);
        return reply.status(201).send(client);
    }
    async handleList(request, reply) {
        const clients = await clientsService.listAll(request.tenantDb);
        return reply.send(clients);
    }
    async handleGetById(request, reply) {
        const { id } = request.params;
        const client = await clientsService.findById(request.tenantDb, id);
        if (!client)
            return reply.status(404).send({ error: 'Cliente não encontrado' });
        return reply.send(client);
    }
    async handleUpdate(request, reply) {
        const { id } = request.params;
        const client = await clientsService.update(request.tenantDb, id, request.body);
        return reply.send(client);
    }
    async handleDelete(request, reply) {
        const { id } = request.params;
        await clientsService.delete(request.tenantDb, id);
        return reply.status(204).send();
    }
}
