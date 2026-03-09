import bcrypt from 'bcryptjs';

import { createTenantDatabase } from './tenant-setup.service';
import { masterDb } from 'src/database/master';

export class AuthService {
  async register(data: any) {
    const { company_name, owner_name, email, password } = data;

    // 1. Lógica de geração de identificadores
    const slug = company_name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const tenantDbName = `db_tenant_${slug.replace(/-/g, '_')}`;

    // 2. Validação de existência
    const existingUser = await masterDb.user.findUnique({ where: { email } });
    if (existingUser) throw new Error('E-mail já cadastrado.');

    // 3. Infraestrutura Automática (Banco + Tabelas)
    await createTenantDatabase(tenantDbName);

    // 4. Persistência no Master (Transação)
    const passwordHash = await bcrypt.hash(password, 10);

    return await masterDb.$transaction(async (db) => {
      const company = await db.company.create({
        data: { name: company_name, slug, tenant_db_name: tenantDbName }
      });

      const user = await db.user.create({
        data: {
          company_id: company.id,
          name: owner_name,
          email,
          password_hash: passwordHash,
          role: 'OWNER'
        }
      });

      return { company, user };
    });
  }

  async validateLogin(email: string, pass: string) {
    const user = await masterDb.user.findUnique({
      where: { email },
      include: { company: true }
    });

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(pass, user.password_hash);
    if (!isPasswordValid) return null;

    return user;
  }
}