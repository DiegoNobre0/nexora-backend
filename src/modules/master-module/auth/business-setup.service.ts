import { execSync } from 'child_process';
import { masterDb } from '../../../database/master';

export async function createBusinessDatabase(businessDbName: string) {
  try {
    console.log(`[BusinessSetup] Criando banco de dados: ${businessDbName}...`);

    // 1. Comando SQL puro para criar o banco de dados no Postgres
    // Usamos o $executeRawUnsafe porque o nome do banco não pode ser parametrizado
    await masterDb.$executeRawUnsafe(`CREATE DATABASE ${businessDbName}`);

    console.log(`[BusinessSetup] Banco ${businessDbName} criado. Rodando tabelas...`);

    // 2. Rodar o 'prisma db push' para o novo banco
    // Usamos a URL base + o nome do novo banco para a conexão temporária
    const businessUrl = `${process.env.DATABASE_BASE_URL}/${businessDbName}?schema=public`;

    // Executamos o comando do Prisma via linha de comando (shell)
    execSync(
      `npx prisma db push --schema=prisma/business/schema.prisma`,
      {
        env: {
          ...process.env,
          BUSINESS_DATABASE_URL: businessUrl, // Forçamos o Prisma a olhar para o novo banco
        },
      }
    );

    console.log(`[BusinessSetup] Tabelas criadas com sucesso em ${businessDbName}!`);
  } catch (error) {
    console.error(`[BusinessSetup] Erro ao configurar business:`, error);
    throw new Error('Falha ao criar infraestrutura da empresa.');
  }
}