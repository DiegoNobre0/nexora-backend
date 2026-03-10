import { UsersController } from './users.controller';
const usersController = new UsersController();
export async function usersRoutes(app) {
    // Adiciona a verificação de JWT para todas as rotas de usuários
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch (err) {
            reply.send(err);
        }
    });
    app.get('/', usersController.list);
    app.post('/', usersController.create);
    app.patch('/me', usersController.updateMe);
}
