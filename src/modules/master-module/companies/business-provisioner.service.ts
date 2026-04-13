import { exec } from 'child_process';
import { promisify } from 'util';
import { masterDb } from '../../../database/master';

const execAsync = promisify(exec);

export class BusinessProvisionerService {
  async setup(dbName: string) {
    try {
      console.log(`[Provisioner] Iniciando criação do tenant: ${dbName}...`);
      
      // 1. Cria o banco fisicamente
      try {
        await masterDb.$executeRawUnsafe(`CREATE DATABASE ${dbName}`);
        console.log(`[Provisioner] Banco ${dbName} criado fisicamente.`);
      } catch (dbError: any) {
        if (dbError.message.includes('already exists')) {
          console.log(`[Provisioner] Banco ${dbName} já existia. Seguindo para o Push...`);
        } else {
          throw dbError;
        }
      }

      // 2. Monta a URL de conexão
      const baseUrl = process.env.DATABASE_URL_BASE?.replace(/\/$/, '');
      if (!baseUrl) throw new Error('DATABASE_URL_BASE ausente no .env');
      
      const newDbUrl = `${baseUrl}/${dbName}?schema=public`;

      // 3. Roda o Prisma Push
      // Passamos a variável BUSINESS_DATABASE_URL que o schema.prisma do business exige
      await execAsync(
        `npx prisma db push --schema=./prisma/business/schema.prisma --accept-data-loss`,
        {
          env: {
            ...process.env,
            BUSINESS_DATABASE_URL: newDbUrl,
          },
        }
      );

      console.log(`[Provisioner] ✅ Tabelas criadas com sucesso no tenant ${dbName}!`);
      return true;
    } catch (error) {
      console.error(`[Provisioner Error]:`, error);
      throw new Error(`Falha ao provisionar a infraestrutura da empresa.`);
    }
  }
}