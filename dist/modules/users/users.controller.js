import { UsersService } from './users.service';
const usersService = new UsersService();
export class UsersController {
    async list(request, reply) {
        // O JWT coloca os dados em request.user (configurado no middleware ou plugin)
        const { company_id } = request.user;
        const users = await usersService.findByCompany(company_id);
        return reply.send(users);
    }
    async create(request, reply) {
        const { company_id } = request.user;
        const user = await usersService.create(company_id, request.body);
        return reply.status(201).send(user);
    }
    async updateMe(request, reply) {
        const { sub: userId } = request.user;
        const user = await usersService.update(userId, request.body);
        return reply.send(user);
    }
}
