import type { FastifyRequest, FastifyReply } from 'fastify';
import { LeadsService } from './leads.service';
import { 
  createLeadSchema, captureDataSchema, updateStatusSchema, assignLeadSchema, 
  registerFollowUpSchema, listLeadsSchema, reportQuerySchema 
} from './leads.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Leads
// ─────────────────────────────────────────────────────────────

// GET /leads
export async function listLeads(request: FastifyRequest, reply: FastifyReply) {
  const filters = listLeadsSchema.parse(request.query);
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.getLeadsByStatus(filters));
}

// POST /leads
export async function createLead(request: FastifyRequest, reply: FastifyReply) {
  const body = createLeadSchema.parse(request.body);
  const service = new LeadsService(request.businessDb);
  return reply.status(201).send(await service.createLead(body));
}

// PUT /leads/:id/data
export async function captureLeadData(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = captureDataSchema.parse(request.body);
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.captureLeadData(id, body));
}

// PATCH /leads/:id/status
export async function updateLeadStatus(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = updateStatusSchema.parse(request.body);
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.updateLeadStatus(id, body.status));
}

// PATCH /leads/:id/assign
export async function assignLead(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = assignLeadSchema.parse(request.body);
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.assignLead(id, body.employee_id));
}

// POST /leads/:id/convert
export async function convertLeadToClient(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.convertLeadToClient(id));
}

// PATCH /leads/:id/archive
export async function archiveLead(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.archiveLead(id));
}

// ─── Timeline ───

// GET /leads/:id/timeline
export async function getLeadTimeline(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.getLeadTimeline(id));
}

// POST /leads/:id/timeline
export async function registerFollowUp(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = registerFollowUpSchema.parse(request.body);
  const service = new LeadsService(request.businessDb);
  return reply.status(201).send(await service.registerFollowUp(id, body));
}

// ─── Relatórios & Exportação ───

// GET /leads/reports/conversion
export async function getConversionRate(request: FastifyRequest, reply: FastifyReply) {
  const query = reportQuerySchema.parse(request.query);
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.getLeadConversionRate(query.days));
}

// GET /leads/reports/sources
export async function getSourceReport(request: FastifyRequest, reply: FastifyReply) {
  const query = reportQuerySchema.parse(request.query);
  const service = new LeadsService(request.businessDb);
  return reply.status(200).send(await service.getLeadSourceReport(query.days));
}

// GET /leads/export
export async function exportLeadsCSV(request: FastifyRequest, reply: FastifyReply) {
  const service = new LeadsService(request.businessDb);
  const csv = await service.exportCSV();
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename="leads.csv"')
    .send(csv);
}