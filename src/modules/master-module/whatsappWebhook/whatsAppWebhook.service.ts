
import { whatsappQueue } from 'src/worker/whatsapp.worker';
import { masterDb } from '../../../database/master';

export class WhatsAppWebhookService {
  // Valida o token enviado pela Meta
  verifyToken(mode: string, token: string, challenge: string) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nexora_verify_token_2026';
    
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    throw new Error('Verification failed');
  }

  // Processa o corpo do Webhook e encaminha para a fila
  async processWebhook(body: any) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    const businessPhoneNumber = value?.metadata?.display_phone_number;

    if (!message || !businessPhoneNumber) return;

    // Remove caracteres não numéricos para buscar no Master DB
    const cleanNumber = businessPhoneNumber.replace(/\D/g, '');

    // Busca qual Business (empresa) possui esse número no Master DB
    const business = await masterDb.company.findFirst({
      where: { 
        // Aqui assumimos que no seu Master DB o número está atrelado à empresa
        whatsapp_number: cleanNumber 
      },
      select: { id: true, name: true, business_db_name: true }
    });

    // Adiciona o trabalho na fila do BullMQ
    await whatsappQueue.add('process-message', {
      from: message.from,
      text: message.text?.body,
      businessId: business?.id || 'unknown',
      businessName: business?.name || 'Nexora Business',
      businessDbName: business?.business_db_name // Para o Worker saber qual banco conectar
    });

    return { success: true };
  }
}