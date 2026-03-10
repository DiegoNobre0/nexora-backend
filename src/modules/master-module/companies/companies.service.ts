import { masterDb } from '../../../database/master';
import { PlansService } from '../plans/plans.service';
import { UsersService } from '../users/users.service';
import { BusinessProvisionerService } from './business-provisioner.service';

const provisioner = new BusinessProvisionerService();
const usersService = new UsersService();
const plansService = new PlansService();

export class CompaniesService {
    async create(data: {
        name: string,
        whatsapp_number: string,
        admin_name: string,    // Novo dado
        admin_email: string,   // Novo dado
        admin_password: string // Novo dado
    }) {
        const slug = data.name.toLowerCase().trim().replace(/\s+/g, '-');
        const dbName = `nexora_business_${slug.replace(/-/g, '_')}`;
        const plan = await masterDb.plan.findFirst({
            where: { is_active: true }
        });

        if (!plan) {
            throw new Error("Nenhum plano configurado no sistema. Execute o seed!");
        }

        // 1. Cria a Empresa no Master
        const company = await masterDb.company.create({
            data: {
                name: data.name,
                slug,
                business_db_name: dbName,
                whatsapp_number: data.whatsapp_number.replace(/\D/g, ''),
                is_active: true,
                subscriptions: {
                    create: {
                        plan_id: plan.id,
                        status: 'TRIALING',
                        current_period_start: new Date(),
                        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // + 7 dias
                    }
                }
            }
        });

        // 2. Provisiona o Banco de Dados (Cria tabelas do Business)
        await provisioner.setup(dbName);

        // 3. SEED: Cria o primeiro usuário OWNER da empresa no Master
        // Usamos o seu UsersService que já faz o hash da senha
        const adminUser = await usersService.create(company.id, {
            name: data.admin_name,
            email: data.admin_email,
            password: data.admin_password,
            role: 'OWNER'
        });



        console.log(`[Onboarding] ✅ Empresa ${company.name} e Admin ${adminUser.email} criados!`);

        return {
            company,
            admin: {
                id: adminUser.id,
                email: adminUser.email
            }
        };
    }

    async list() {
        return await masterDb.company.findMany({
            include: { _count: { select: { users: true } } }
        });
    }

    async getById(id: string) {
        return await masterDb.company.findUnique({ where: { id } });
    }
}