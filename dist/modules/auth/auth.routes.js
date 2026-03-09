import bcrypt from 'bcryptjs';
import { masterDb } from '../../database/master';
export async function authRoutes(app) {
    app.post('/login', async (request, reply) => {
        const { email, password } = request.body;
        if (!email || !password) {
            return reply.status(400).send({ error: 'E-mail e senha são obrigatórios.' });
        }
        // 1. Busca o usuário no banco Master e já traz a tabela da Empresa (para pegar o tenant_db_name)
        const user = await masterDb.user.findUnique({
            where: { email },
            include: { company: true },
        });
        // 2. Verifica se o usuário existe e se a senha bate com o hash criptografado
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return reply.status(401).send({ error: 'Credenciais inválidas.' });
        }
        // 3. A MÁGICA: Cria o "conteúdo" do Token com a informação de roteamento
        const tokenPayload = {
            sub: user.id,
            company_id: user.company_id,
            tenant_db_name: user.company.tenant_db_name, // O Middleware vai ler isso depois!
            role: user.role
        };
        // 4. Assina o token com a nossa chave secreta
        const token = app.jwt.sign(tokenPayload, { expiresIn: '7d' });
        // 5. Devolve o token e os dados básicos para o Angular salvar no LocalStorage
        return reply.send({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                company_name: user.company.name
            }
        });
    });
}
