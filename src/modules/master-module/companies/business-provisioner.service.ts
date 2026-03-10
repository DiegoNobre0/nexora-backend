import { exec } from 'child_process';
import { promisify } from 'util';
import { masterDb } from '../../../database/master';

const execAsync = promisify(exec);

export class BusinessProvisionerService {
  /**
   * 1. Cria o banco de dados físico no Postgres
   * 2. Sobe o schema do Business para esse novo banco
   */
  async setup(dbName: string) {
    try {
      console.log(`[Provisioner] Criando banco de dados: ${dbName}...`);
      
      // 1. Criar o banco de dados fisicamente via SQL
      // Nota: O usuário do banco precisa ter permissão de CREATEDB
      await masterDb.$executeRawUnsafe(`CREATE DATABASE ${dbName}`);

      // 2. Montar a URL de conexão para o novo banco
      const baseUrl = process.env.DATABASE_URL_BASE; // Ex: postgresql://user:pass@localhost:5432/
      const newDbUrl = `${baseUrl}${dbName}`;

      console.log(`[Provisioner] Subindo tabelas do Prisma para ${dbName}...`);

      // 3. Executar o 'prisma db push' apontando para o schema do business
      // Usamos env vars temporárias para o comando entender o novo banco
      await execAsync(
        `npx prisma db push --schema=./prisma/business/schema.prisma --accept-data-loss`,
        {
          env: {
            ...process.env,
            DATABASE_URL: newDbUrl, // Sobrescreve a URL apenas para esse comando
          },
        }
      );

      console.log(`[Provisioner] ✅ Banco ${dbName} configurado com sucesso!`);
      return true;
    } catch (error) {
      console.error(`[Provisioner Error]:`, error);
      throw new Error(`Falha ao provisionar o banco de dados do cliente.`);
    }
  }
}