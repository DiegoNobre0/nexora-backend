import { FastifyRequest, FastifyReply } from 'fastify';
import { PromoKitsService } from './promo-kits.service';
import { createPromoKitSchema, updatePromoKitSchema } from './promo-kits.schema';



// POST /promo-kits
export async function createPromoKit(request: FastifyRequest, reply: FastifyReply) {
  let bodyObj: any = {};
  const uploadedImages: Buffer[] = []; // ✅ tipo correto

  if (request.isMultipart()) {
    for await (const part of request.parts()) {
      if (part.type === 'file' && part.fieldname.startsWith('image_')) {
        const buffer = await part.toBuffer();
        if (buffer.length > 0) {
          uploadedImages.push(buffer); // ✅ só o Buffer, sem wrapper
        }
      } else if (part.type === 'field') {
        bodyObj[part.fieldname] = part.value;
      }
    }
  } else {
    bodyObj = request.body || {};
  }

  const parsedBody = createPromoKitSchema.parse(bodyObj);

  const service = new PromoKitsService(request.businessDb, request.jwtPayload.business_db_name);
  const result = await service.createPromoKit(parsedBody, uploadedImages); // ✅ passa Buffer[] direto

  return reply.status(201).send(result);
}


// PUT /promo-kits/:id
export async function updatePromoKit(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const bodyObj: any = {};
  const imageBuffers: Buffer[] = [];

  // Processa o multipart/form-data
  for await (const part of request.parts()) {
    if (part.type === 'file' && part.fieldname.startsWith('image_')) {
      const buffer = await part.toBuffer();
      imageBuffers.push(buffer);
    } else if (part.type === 'field') {
      bodyObj[part.fieldname] = part.value;
    }
  }

  // Valida e envia pro Service
  const parsedBody = updatePromoKitSchema.parse(bodyObj);
  const service = new PromoKitsService(request.businessDb, request.jwtPayload.business_db_name);
  const result = await service.updatePromoKit(id, parsedBody, imageBuffers);

  return reply.status(200).send(result);
}

// GET /promo-kits
export async function listPromoKits(request: FastifyRequest, reply: FastifyReply) {
  const service = new PromoKitsService(request.businessDb, request.jwtPayload.business_db_name);
  const result = await service.listPromoKits();
  return reply.status(200).send(result);
}

// DELETE /promo-kits/:id
export async function deletePromoKit(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const service = new PromoKitsService(request.businessDb, request.jwtPayload.business_db_name);
  const result = await service.deletePromoKit(id);
  return reply.status(200).send(result);
}