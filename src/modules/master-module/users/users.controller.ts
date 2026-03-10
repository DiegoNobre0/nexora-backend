import type { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from './users.service';

const usersService = new UsersService();

export class UsersController {
async list(request: FastifyRequest, reply: FastifyReply) {
    // O JWT coloca os dados em request.user (configurado no middleware ou plugin)
    const { company_id } = request.user as any; 
    const users = await usersService.findByCompany(company_id);
    return reply.send(users);
  }


  async create(request: FastifyRequest, reply: FastifyReply) {
    const { company_id } = request.user as any;
    const user = await usersService.create(company_id, request.body);
    return reply.status(201).send(user);
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const { sub: userId } = request.user as any;
    const user = await usersService.update(userId, request.body);
    return reply.send(user);
  }
}