import IORedis from 'ioredis';

// Este arquivo agora é a única fonte da verdade para o Redis
export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});