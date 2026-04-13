import type { FastifyRequest, FastifyReply } from 'fastify';
import { CategoriesService } from './categories.service';
import { createCategorySchema, updateCategorySchema, listCategoriesSchema } from './categories.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Categories
//
// Responsabilidade única: receber a requisição, validar os dados
// com Zod e delegar para o service. Nenhuma lógica de negócio aqui.
//
// O businessDb já foi injetado no request pelo businessMiddleware.
// ─────────────────────────────────────────────────────────────

// GET /categories
export async function listCategories(request: FastifyRequest, reply: FastifyReply) {
  const filters = listCategoriesSchema.parse(request.query);
  const service = new CategoriesService(request.businessDb);
  const result  = await service.list(filters);
  return reply.status(200).send(result);
}

// GET /categories/:id
export async function getCategory(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new CategoriesService(request.businessDb);
  const result  = await service.findById(id);
  return reply.status(200).send(result);
}

// POST /categories
export async function createCategory(request: FastifyRequest, reply: FastifyReply) {
  const body    = createCategorySchema.parse(request.body);
  const service = new CategoriesService(request.businessDb);
  const result  = await service.create(body);
  return reply.status(201).send(result);
}

// PUT /categories/:id
export async function updateCategory(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = updateCategorySchema.parse(request.body);
  const service = new CategoriesService(request.businessDb);
  const result  = await service.update(id, body);
  return reply.status(200).send(result);
}

// DELETE /categories/:id
export async function deleteCategory(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new CategoriesService(request.businessDb);
  const result  = await service.delete(id);
  return reply.status(200).send(result);
}

// PATCH /categories/:id/toggle
export async function toggleCategory(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new CategoriesService(request.businessDb);
  const result  = await service.toggle(id);
  return reply.status(200).send(result);
}