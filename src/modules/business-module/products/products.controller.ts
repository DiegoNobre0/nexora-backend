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
// ─────────────────────────────────────────────────────────────

// GET /products
export async function listProducts(request: FastifyRequest, reply: FastifyReply) {
  const filters = listProductsSchema.parse(request.query);
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.listProducts(filters));
}

// GET /products/:id
export async function getProduct(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.getProductById(id));
}

// GET /products/barcode/:code
export async function getProductByBarcode(request: FastifyRequest, reply: FastifyReply) {
  const { code } = request.params as { code: string };
  const service  = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.getProductByBarcode(code));
}

// POST /products
export async function createProduct(request: FastifyRequest, reply: FastifyReply) {
  const bodyObj: any = {};
  let imageBuffer: Buffer | undefined;

  // 1. Processa a requisição multipart iterando pelas partes
  for await (const part of request.parts()) {
    if (part.type === 'file' && part.fieldname === 'image') {
      // É a nossa imagem! Transformamos a stream em Buffer
      imageBuffer = await part.toBuffer();
    } else if (part.type === 'field') {
      // É um campo de texto (nome, preco, etc). Adicionamos ao objeto
      bodyObj[part.fieldname] = part.value;
    }
  }

  // 2. Normalização: FormData envia tudo como string. 
  // Precisamos converter 'true'/'false' de volta para booleano pro Zod não reclamar.
  if (bodyObj.is_active === 'true') bodyObj.is_active = true;
  if (bodyObj.is_active === 'false') bodyObj.is_active = false;

  // 3. Valida os campos de texto com o seu Schema Zod existente
  const parsedBody = createProductSchema.parse(bodyObj);

  // 4. Instancia o serviço e passa os dados + o buffer da imagem
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  const result = await service.createProduct(parsedBody, imageBuffer);

  return reply.status(201).send(result);
}

// PUT /products/:id
export async function updateProduct(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  
  const bodyObj: any = {};
  let imageBuffer: Buffer | undefined;

  // 1. Processa o FormData da edição
  for await (const part of request.parts()) {
    if (part.type === 'file' && part.fieldname === 'image') {
      imageBuffer = await part.toBuffer();
    } else if (part.type === 'field') {
      bodyObj[part.fieldname] = part.value;
    }
  }

  // 2. Normalização de booleanos
  if (bodyObj.is_active === 'true') bodyObj.is_active = true;
  if (bodyObj.is_active === 'false') bodyObj.is_active = false;

  // 3. Valida com Zod (updateProductSchema permite campos parciais)
  const parsedBody = updateProductSchema.parse(bodyObj);
  
  // 4. Executa a atualização
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  const result = await service.updateProduct(id, parsedBody, imageBuffer);

  return reply.status(200).send(result);
}
// DELETE /products/:id
export async function deleteProduct(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.deleteProduct(id));
}

// PATCH /products/:id/pause
export async function pauseProduct(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.pauseProduct(id));
}

// PATCH /products/:id/stock
export async function updateStock(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = updateStockSchema.parse(request.body);
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.updateStock(id, body));
}

// GET /products/:id/availability?quantity=5
export async function checkAvailability(request: FastifyRequest, reply: FastifyReply) {
  const { id }       = request.params as { id: string };
  const { quantity } = request.query  as { quantity: string };
  const service      = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.checkAvailability(id, Number(quantity)));
}

// GET /products/low-stock
export async function getLowStockAlert(request: FastifyRequest, reply: FastifyReply) {
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.lowStockAlert());
}

// POST /products/:id/barcodes
export async function registerBarcode(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body    = registerBarcodeSchema.parse(request.body);
  const service = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(201).send(await service.registerBarcode(id, body));
}

// DELETE /products/:id/barcodes/:barcodeId
export async function removeBarcode(request: FastifyRequest, reply: FastifyReply) {
  const { id, barcodeId } = request.params as { id: string; barcodeId: string };
  const service           = new ProductsService(request.businessDb, request.jwtPayload.business_db_name);
  return reply.status(200).send(await service.removeBarcode(id, barcodeId));
}