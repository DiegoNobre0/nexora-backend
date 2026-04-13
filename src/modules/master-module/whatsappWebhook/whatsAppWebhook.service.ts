import crypto from 'crypto';
import Redis from 'ioredis';
import { masterDb } from '../../../database/master';
import { getBusinessClient } from '../../../database/business-manager';

import type { ParsedMessage, WebhookMessagePayload } from './whatsappWebhook.types';
import { whatsappQueue } from 'src/worker/whatsapp.queue';

// Inicializa o Redis (mesma instância do BullMQ)
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export class WhatsAppWebhookService {
  
  // ─── 1. Verificação de Assinatura e Setup ──────────────────

  verifyToken(mode: string, token: string, challenge: string) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nexora_verify_token_2026';
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    throw new Error('Verification failed');
  }

  verifySignature(signature: string, rawBody: string) {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.warn('⚠️ META_APP_SECRET não configurado. Pulando validação de assinatura.');
      return true;
    }
    
    // A Meta envia a assinatura no formato: sha256=HASH
    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const expectedSignature = `sha256=${expectedHash}`;
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // ─── 2. Fluxo Principal de Processamento ───────────────────

  async processWebhook(body: any) {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messageData = value?.messages?.[0] as WebhookMessagePayload;
      const businessPhoneNumber = value?.metadata?.display_phone_number;

      // Se não for uma mensagem de usuário (ex: status de lido/entregue), ignora silenciosamente
      if (!messageData || !businessPhoneNumber) return;

      // Proteção contra duplicação (Idempotência)
      // A Meta costuma reenviar webhooks se houver lentidão na rede
      const isDuplicate = await redis.setnx(`processed_msg:${messageData.id}`, '1');
      if (isDuplicate === 0) {
        return; // Já processamos esta mensagem
      }
      await redis.expire(`processed_msg:${messageData.id}`, 300); // Guarda por 5 minutos

      // 3. Parser da Mensagem
      const parsedMessage = this.parseMessage(messageData);

      // 4. Descobre qual é a Empresa (Tenant)
      const cleanBusinessNumber = businessPhoneNumber.replace(/\D/g, '');
      const company = await masterDb.company.findFirst({
        where: { whatsapp_number: cleanBusinessNumber },
        select: { id: true, business_db_name: true }
      });

      if (!company) {
        console.error(`Empresa não encontrada para o número: ${cleanBusinessNumber}`);
        return;
      }

      // 5. Salva no Histórico do Redis (Contexto para o LLM - TTL 24h)
      await this.saveMessageToHistory(company.id, parsedMessage);

      // 6. Roteador de Fluxo (Lead vs Cliente)
      const businessDb = getBusinessClient(company.business_db_name);
      
      const client = await businessDb.client.findUnique({
        where: { phone: parsedMessage.phone },
        select: { id: true, name: true }
      });

      // 7. Envia para a fila correta
      const jobName = client ? 'client-flow' : 'lead-flow';
      
      await whatsappQueue.add(jobName, {
        company_id: company.id,
        business_db_name: company.business_db_name,
        client_id: client?.id || null, // Nulo se for fluxo de Lead
        phone: parsedMessage.phone,
        message: parsedMessage,
      });

    } catch (error) {
      console.error('[Webhook Process Error]:', error);
      // Não lançamos erro aqui para não quebrar o ciclo assíncrono do controller
    }
  }

  // ─── 3. Parser Universal ───────────────────────────────────

  private parseMessage(msg: WebhookMessagePayload): ParsedMessage {
    const cleanPhone = msg.from.replace(/\D/g, '');
    let content = '';

    switch (msg.type) {
      case 'text':
        content = msg.text?.body || '';
        break;
      case 'audio':
        content = msg.audio?.id || ''; // Guardamos o ID para baixar depois
        break;
      case 'image':
        content = msg.image?.id || '';
        break;
      case 'interactive':
        if (msg.interactive?.type === 'button_reply') {
          content = msg.interactive.button_reply?.id || '';
        } else if (msg.interactive?.type === 'list_reply') {
          content = msg.interactive.list_reply?.id || '';
        }
        break;
      default:
        content = '[Tipo de mensagem não suportado]';
        msg.type = 'unknown';
    }

    return {
      messageId: msg.id,
      phone: cleanPhone,
      type: msg.type,
      content,
      raw_payload: msg, // Passamos o raw completo caso o worker precise de metadados
    };
  }

  // ─── 4. Gestão de Contexto (Redis) ─────────────────────────

  private async saveMessageToHistory(companyId: string, msg: ParsedMessage) {
    // Chave única para a conversa nas últimas 24h
    const sessionKey = `chat_history:${companyId}:${msg.phone}`;
    
    const historyEntry = JSON.stringify({
      role: 'user', // Quem enviou foi o usuário
      type: msg.type,
      content: msg.content,
      timestamp: new Date().toISOString(),
    });

    // Adiciona na lista do Redis
    await redis.rpush(sessionKey, historyEntry);
    
    // Mantém apenas as últimas 50 mensagens para não estourar limite do LLM
    await redis.ltrim(sessionKey, -50, -1);
    
    // Renova o TTL para 24 horas (86400 segundos) a cada nova mensagem
    await redis.expire(sessionKey, 86400);
  }
}