import type { FastifyRequest, FastifyReply } from 'fastify';
import { ClientsService } from './clients.service';
import { 
  createClientSchema, 
  updateClientSchema, 
  listClientsSchema, 
  blockClientSchema,
  addressSchema,
  updateAddressSchema
} from './clients.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Clients
// ─────────────────────────────────────────────────────────────

export async function listClients(request: FastifyRequest, reply: FastifyReply) {
  const filters = listClientsSchema.parse(request.query);
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.list(filters));
}

export async function getClientById(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.getClientById(id));
}

// Útil para o painel de atendente buscar clientes pelo documento
export async function getClientByDocument(request: FastifyRequest, reply: FastifyReply) {
  const { doc } = request.params as { doc: string };
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.getClientByDocument(doc));
}

export async function createClient(request: FastifyRequest, reply: FastifyReply) {
  const body = createClientSchema.parse(request.body);
  const service = new ClientsService(request.businessDb);
  return reply.status(201).send(await service.createClient(body));
}

export async function updateClient(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = updateClientSchema.parse(request.body);
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.updateClient(id, body));
}

export async function blockClient(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = blockClientSchema.parse(request.body);
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.blockClient(id, body.reason));
}

export async function unblockClient(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.unblockClient(id));
}

export async function mergeClients(request: FastifyRequest, reply: FastifyReply) {
  const { primaryId, secondaryId } = request.body as { primaryId: string; secondaryId: string };
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.mergeClients(primaryId, secondaryId));
}

// ─── Endereços ───

export async function addAddress(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }; // Client ID
  const body = addressSchema.parse(request.body);
  const service = new ClientsService(request.businessDb);
  return reply.status(201).send(await service.addAddress(id, body));
}

export async function updateAddress(request: FastifyRequest, reply: FastifyReply) {
  const { addressId } = request.params as { addressId: string };
  const body = updateAddressSchema.parse(request.body);
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.updateAddress(addressId, body));
}

export async function deleteAddress(request: FastifyRequest, reply: FastifyReply) {
  const { addressId } = request.params as { addressId: string };
  const service = new ClientsService(request.businessDb);
  return reply.status(200).send(await service.deleteAddress(addressId));
}

// ─── Exportação ───

export async function exportClientsCSV(request: FastifyRequest, reply: FastifyReply) {
  const service = new ClientsService(request.businessDb);
  const csv = await service.exportCSV();
  
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename="clientes.csv"')
    .send(csv);
}