import { masterDb } from '../../../database/master';
import { UsersService } from '../users/users.service';
import { BusinessProvisionerService } from './business-provisioner.service';

const provisioner = new BusinessProvisionerService();
const usersService = new UsersService();

export class CompaniesService {
  async create(data: any) {
    const { name, whatsapp_number, admin_name, admin_email, admin_password } = data;

    // Valida se o email já existe no Master DB para evitar conflitos
    const existingUser = await masterDb.user.findUnique({ where: { email: admin_email } });
    if (existingUser) throw new Error('Este e-mail já está em uso por outro usuário.');

    const slug = name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-');
    const dbName = `nexora_business_${slug.replace(/-/g, '_')}`;
    
    const plan = await masterDb.plan.findFirst({ where: { name: { contains: 'Starter', mode: 'insensitive' } } }) 
              || await masterDb.plan.findFirst({ where: { is_active: true } });

    if (!plan) throw new Error("Nenhum plano configurado no sistema. Execute o seed!");

    // 1. Cria a Empresa + Assinatura Trial no Master
    const company = await masterDb.company.create({
      data: {
        name,
        slug,
        business_db_name: dbName,
        whatsapp_number: whatsapp_number.replace(/\D/g, ''),
        is_active: true,
        subscriptions: {
          create: {
            plan_id: plan.id,
            status: 'TRIALING',
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 dias trial
          }
        }
      }
    });

    // 2. Provisiona o Banco de Dados do Cliente
    await provisioner.setup(dbName);

    // 3. Cria o usuário Admin/Owner
    const adminUser = await usersService.create(company.id, {
      name: admin_name,
      email: admin_email,
      password: admin_password,
      role: 'OWNER'
    });

    return { company, admin: { id: adminUser.id, email: adminUser.email } };
  }

  async list() {
    return await masterDb.company.findMany({
      include: { 
        _count: { select: { users: true } },
        subscriptions: { include: { plan: { select: { name: true } } }, take: 1, orderBy: { created_at: 'desc' } }
      }
    });
  }
}