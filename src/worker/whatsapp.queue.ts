import { Queue } from 'bullmq';
import { redisConnection } from '../shared/redis/connection';

export const whatsappQueue = new Queue('whatsapp-messages', { 
  connection: redisConnection as any,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
});