import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProductsService } from './products.service';
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  updateStockSchema,
  registerBarcodeSchema,
} from './products.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Products
//
// Apenas valida entrada e delega para o service.
// ─────────────────────────────────────────────────────────────

// GET /products
export async function listProducts(request: FastifyRequest, reply: FastifyReply) {
  const filters = listProductsSchema.parse(request.query);
  const service = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.listProducts(filters));
}

// GET /products/:id
export async function getProduct(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.getProductById(id));
}

// GET /products/barcode/:code
export async function getProductByBarcode(request: FastifyRequest, reply: FastifyReply) {
  const { code } = request.params as { code: string };
  const service  = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.getProductByBarcode(code));
}

// POST /products
export async function createProduct(request: FastifyRequest, reply: FastifyReply) {
  const body    = createProductSchema.parse(request.body);
  const service = new ProductsService(request.businessDb);
  return reply.status(201).send(await service.createProduct(body));
}

// PUT /products/:id
export async function updateProduct(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = updateProductSchema.parse(request.body);
  const service = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.updateProduct(id, body));
}

// DELETE /products/:id
export async function deleteProduct(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.deleteProduct(id));
}

// PATCH /products/:id/pause
export async function pauseProduct(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.pauseProduct(id));
}

// PATCH /products/:id/stock
export async function updateStock(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = updateStockSchema.parse(request.body);
  const service = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.updateStock(id, body));
}

// GET /products/:id/availability?quantity=5
export async function checkAvailability(request: FastifyRequest, reply: FastifyReply) {
  const { id }       = request.params as { id: string };
  const { quantity } = request.query  as { quantity: string };
  const service      = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.checkAvailability(id, Number(quantity)));
}

// GET /products/low-stock
export async function getLowStockAlert(request: FastifyRequest, reply: FastifyReply) {
  const service = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.lowStockAlert());
}

// POST /products/:id/barcodes
export async function registerBarcode(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = registerBarcodeSchema.parse(request.body);
  const service = new ProductsService(request.businessDb);
  return reply.status(201).send(await service.registerBarcode(id, body));
}

// DELETE /products/:id/barcodes/:barcodeId
export async function removeBarcode(request: FastifyRequest, reply: FastifyReply) {
  const { id, barcodeId } = request.params as { id: string; barcodeId: string };
  const service           = new ProductsService(request.businessDb);
  return reply.status(200).send(await service.removeBarcode(id, barcodeId));
}