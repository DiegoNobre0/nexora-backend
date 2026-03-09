import { PrismaClient } from '@prisma/client';

// Essa é a conexão com o banco de dados principal (SaaS)
export const masterDb = new PrismaClient();