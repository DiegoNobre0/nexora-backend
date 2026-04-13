import Redis from 'ioredis';

// Usa a mesma instância do worker/webhook
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export interface ChatSession {
  phone: string;
  client_id?: string | null;
  lead_id?: string | null;
  is_human_handoff: boolean;
  current_flow?: string;
  last_interaction: string;
}

export class BotSession {
  constructor(private readonly businessId: string, private readonly phone: string) {}

  private get sessionKey() {
    return `session:${this.businessId}:${this.phone}`;
  }

  async get(): Promise<ChatSession | null> {
    const data = await redis.get(this.sessionKey);
    return data ? JSON.parse(data) : null;
  }

  async save(session: Partial<ChatSession>) {
    const current = await this.get() || {
      phone: this.phone,
      is_human_handoff: false,
      last_interaction: new Date().toISOString(),
    };

    const updated = { ...current, ...session, last_interaction: new Date().toISOString() };
    
    // Salva com TTL de 24 horas (Renova a cada mensagem)
    await redis.set(this.sessionKey, JSON.stringify(updated), 'EX', 86400);
    return updated;
  }

  // Se ativado, o bot ignora as mensagens e deixa o atendente humano falar
  async escalateToHuman() {
    await this.save({ is_human_handoff: true, current_flow: 'HUMAN' });
  }

  async resumeBot() {
    await this.save({ is_human_handoff: false, current_flow: undefined });
  }
}