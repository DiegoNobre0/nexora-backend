import { masterDb } from './master';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Iniciando a criação de dados de teste...');

  // 1. Criptografa a senha "123456"
  const passwordHash = await bcrypt.hash('123456', 10);

  // 2. Cria a empresa teste
  const company = await masterDb.company.create({
    data: {
      name: 'Barbearia do Zé',
      slug: 'barbearia-do-ze',
      business_db_name: 'db_business_ze', // O nome do banco isolado dele
      document: '12345678900',
    }
  });

  // 3. Cria o usuário dono atrelado à empresa
  const user = await masterDb.user.create({
    data: {
      company_id: company.id,
      name: 'Zé Barbeiro',
      email: 'ze@barbearia.com',
      password_hash: passwordHash,
      role: 'OWNER'
    }
  });

  console.log('✅ Dados criados com sucesso!');
  console.log(`➡️ Email: ${user.email}`);
  console.log(`➡️ Senha: 123456`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await masterDb.$disconnect();
  });