import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client'; 
import * as dotenv from 'dotenv';

dotenv.config();

// Este cliente conecta no nexora_master via MASTER_DATABASE_URL
const masterDb = new PrismaClient();

async function migrateAll() {
  console.log('🚀 Nexora: Sincronizando Alterações em todos os Tenants...\n');

  try {
    // 1. Busca todas as empresas no banco MASTER usando os nomes do seu schema
    const companies = await masterDb.company.findMany({
      select: { name: true, business_db_name: true }
    });

    if (companies.length === 0) {
      console.log('⚠️ Nenhuma empresa encontrada no Banco Master.');
      return;
    }

    // 2. Prepara a URL base usando sua variável do .env como molde
    const templateUri = process.env.BUSINESS_DATABASE_URL || '';
    const baseUrl = templateUri.substring(0, templateUri.lastIndexOf('/'));

    console.log(`📦 Encontrados ${companies.length} bancos de clientes para atualizar.\n`);

    for (const company of companies) {
      if (!company.business_db_name) continue;

      console.log(`⏳ Atualizando: [${company.name}] (Banco: ${company.business_db_name})...`);

      // 3. Constrói a URL dinâmica para este cliente específico
      const tenantUrl = `${baseUrl}/${company.business_db_name}?schema=public`;

      try {
        // Injeta a URL na variável BUSINESS_DATABASE_URL que o seu schema business usa
        execSync('npx prisma db push --schema=prisma/business/schema.prisma --accept-data-loss', {
          stdio: 'inherit',
          env: {
            ...process.env,
            BUSINESS_DATABASE_URL: tenantUrl 
          }
        });
        console.log(`✅ [${company.name}] sincronizado com sucesso!\n`);
      } catch (err) {
        console.error(`❌ Falha ao atualizar o banco de [${company.name}]`);
      }
    }

    console.log('🎉 Sincronização global concluída!');

  } catch (error) {
    console.error('Erro fatal no script de migração:', error);
  } finally {
    await masterDb.$disconnect();
  }
}
//para adicionar coluna business
//primeiro npx prisma generate --schema=prisma/business/schema.prisma
//segundo npx tsx src/migrate-all-tenants.ts
migrateAll();