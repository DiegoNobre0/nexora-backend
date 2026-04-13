import { Queue } from 'bullmq';
import { redisConnection } from 'src/shared/redis/connection';

// ─────────────────────────────────────────────────────────────
// FILA — WhatsApp & Bot Jobs
// ─────────────────────────────────────────────────────────────

export const whatsappQueue = new Queue('whatsapp-queue', { 
  connection: redisConnection as any,
  defaultJobOptions: { 
    attempts: 3, 
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true, // Mantém o Redis limpo
    removeOnFail: false,    // Permite debugar jobs que falharam
  }
});