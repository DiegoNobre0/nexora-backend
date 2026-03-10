import { AuthService } from './auth.service';
const authService = new AuthService();
export class AuthController {
    async register(request, reply) {
        try {
            const result = await authService.register(request.body);
            return reply.send({ message: 'Empresa criada com sucesso!', company: result.company });
        }
        catch (error) {
            return reply.status(400).send({ error: error.message });
        }
    }
    async login(request, reply) {
        const { email, password } = request.body;
        const user = await authService.validateLogin(email, password);
        if (!user) {
            return reply.status(401).send({ error: 'Credenciais inválidas.' });
        }
        const token = request.server.jwt.sign({
            sub: user.id,
            company_id: user.company_id,
            tenant_db_name: user.company.tenant_db_name,
            role: user.role
        }, { expiresIn: '1d' });
        return reply.send({ token, user: { name: user.name, email: user.email, company: user.company.name } });
    }
}
