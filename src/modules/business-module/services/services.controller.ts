import type { FastifyRequest, FastifyReply } from 'fastify';
import { ServicesService } from './services.service';
import { z } from 'zod';

// 1. Definimos o Schema de validação
const serviceSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  price: z.number().positive("O preço deve ser maior que zero"),
  duration_minutes: z.number().int().min(5, "A duração mínima é de 5 minutos"),
  description: z.string().optional()
});

const servicesService = new ServicesService();

export class ServicesController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      // 2. O Zod valida o corpo da requisição e já devolve os dados tipados
      const data = serviceSchema.parse(request.body);

      const service = await servicesService.create(request.businessDb, data);
      return reply.status(201).send(service);
    } catch (error) {
      // Se a validação falhar, o Zod lança um erro que capturamos aqui
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Erro de validação', 
          details: error.flatten().fieldErrors 
        });
      }
      return reply.status(500).send({ error: 'Erro interno no servidor' });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const services = await servicesService.listAll(request.businessDb);
    return reply.send(services);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = await servicesService.findById(request.businessDb, id);
    if (!service) return reply.status(404).send({ error: 'Serviço não encontrado' });
    return reply.send(service);
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    // Dica: Aqui você também poderia usar o .partial() do Zod para validar updates parciais
    const service = await servicesService.update(request.businessDb, id, request.body);
    return reply.send(service);
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await servicesService.delete(request.businessDb, id);
    return reply.status(204).send();
  }
}