import * as dotenv from 'dotenv';
dotenv.config(); // Força a leitura do .env no momento exato em que o arquivo é chamado

import { execSync } from 'child_process';
import { masterDb } from 'src/database/master'; // Ajuste o caminho se necessário

export async function createBusinessDatabase(businessDbName: string) {
  try {
    console.log(`[BusinessSetup] Criando banco de dados: ${businessDbName}...`);

    try {
      await masterDb.$executeRawUnsafe(`CREATE DATABASE ${businessDbName}`);
      console.log(`[BusinessSetup] Banco ${businessDbName} criado no Postgres.`);
    } catch (dbError: any) {
      if (dbError.message.includes('already exists')) {
        console.log(`[BusinessSetup] Banco ${businessDbName} já existia, continuando...`);
      } else {
        throw dbError;
      }
    }

    // 🚨 RAIO-X: Vamos imprimir no console quais variáveis o Node encontrou
    // Isso vai te mostrar se a sua variável se chama DATABASE_URL, DB_URL, MASTER_URL, etc.
    console.log(`[BusinessSetup] Chaves disponíveis no .env:`, Object.keys(process.env).filter(k => k.includes('DB') || k.includes('URL')));

    // 👇 SE O SEU .ENV USAR OUTRO NOME, TROQUE AQUI!
    const urlDoBanco = process.env.MASTER_DATABASE_URL;

    if (!urlDoBanco) {
      throw new Error('DATABASE_URL não encontrada no .env. Verifique o nome da variável!');
    }

    const dbUrl = new URL(urlDoBanco);
    dbUrl.pathname = `/${businessDbName}`; 
    const businessUrl = dbUrl.toString();

    console.log(`[BusinessSetup] Rodando Prisma Push para gerar tabelas...`);

    execSync(
      `npx prisma db push --schema=prisma/business/schema.prisma`,
      {
        env: {
          ...process.env,
          BUSINESS_DATABASE_URL: businessUrl, 
        },
        stdio: 'inherit' 
      }
    );

    console.log(`[BusinessSetup] 🎉 Tabelas criadas com sucesso em ${businessDbName}!`);
  } catch (error) {
    console.error(`[BusinessSetup] Erro ao configurar business:`, error);
    throw new Error('Falha ao criar infraestrutura da empresa.');
  }
}