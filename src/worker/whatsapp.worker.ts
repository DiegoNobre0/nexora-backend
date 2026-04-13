import { Worker, type Job } from 'bullmq';
import { app } from 'src/app';
import { getBusinessClient } from 'src/database/business-manager';
import { masterDb } from 'src/database/master';
import { BotRouter } from 'src/integrations/whatsapp/bot/bot.router';
import { WhatsAppIntegrationService } from 'src/integrations/whatsapp/whatsappIntegration.service';
import { redisConnection } from 'src/shared/redis/connection';

// ─────────────────────────────────────────────────────────────
// WORKER — WhatsApp & Bot
//
// Processa mensagens recebidas em background via BotRouter
// e dispara mensagens ativas (Notificações, Follow-ups, Alertas).
// ─────────────────────────────────────────────────────────────

export const whatsappWorker = new Worker('whatsapp-queue', async (job: Job) => {
  const { company_id, business_db_name } = job.data;
  
  if (!company_id || !business_db_name) {
    throw new Error('Job descartado: Faltam dados de roteamento do Tenant.');
  }

  try {
    // 1. Validação de Assinatura (SaaS Segurança)
    // Se a empresa não pagou, o bot não responde e o webhook morre aqui.
    const company = await masterDb.company.findUnique({ 
      where: { id: company_id },
      include: { subscriptions: { orderBy: { created_at: 'desc' }, take: 1 } }
    });

    const sub = company?.subscriptions[0];
    const isInactive = !company?.is_active || !sub || sub.status === 'CANCELED' || (new Date() > sub.current_period_end);

    if (isInactive) {
      console.warn(`[Worker] Tenant ${business_db_name} inativo. Job ignorado.`);
      return;
    }

    // 2. Conecta no banco da empresa e pega credenciais da Meta
    const businessDb = getBusinessClient(business_db_name);
    const config = await businessDb.config.findFirst();

    if (!config || !config.whatsapp_token || !config.whatsapp_phone_id) {
      throw new Error(`Credenciais da Meta não configuradas para o tenant ${business_db_name}`);
    }

    const whatsappAPI = new WhatsAppIntegrationService(config.whatsapp_token, config.whatsapp_phone_id);

    // 3. Roteador de Jobs
    switch (job.name) {
      
      // ─── FLUXOS CONVERSACIONAIS (Vindos do Webhook) ───
      case 'lead-flow':
      case 'client-flow': {
        const { phone, client_id, message } = job.data;
        
        // Emite evento pro Dashboard Front-end (Tempo real)
        app.io.to(company_id).emit('chat_status', { 
          phone, 
          status: 'processing', 
          text: message.content 
        });

        // Delega para o Cérebro (Bot Engine)
        const botRouter = new BotRouter(businessDb, company_id, config.whatsapp_token, config.whatsapp_phone_id);
        await botRouter.handleMessage(phone, message.content, client_id || null);

        app.io.to(company_id).emit('chat_status', { phone, status: 'replied' });
        break;
      }

      // ─── DISPAROS ATIVOS (Templates e Notificações) ───
      
      case 'order-notification': {
        const { phone, order_id, status, template_name } = job.data;
        // Ex: Manda template de "Seu pedido saiu para entrega!"
        await whatsappAPI.sendTemplateMessage(phone, template_name, 'pt_BR', [
          { type: 'body', parameters: [{ type: 'text', text: order_id }] }
        ]);
        break;
      }

      case 'lead-followup': {
        const { phone, template_name } = job.data;
        // Disparo da cadência de nutrição (Lead Morno/Frio)
        await whatsappAPI.sendTemplateMessage(phone, template_name);
        break;
      }

      case 'send-template': {
        // Envio genérico de template
        const { phone, template_name, parameters } = job.data;
        await whatsappAPI.sendTemplateMessage(phone, template_name, 'pt_BR', parameters);
        break;
      }

      case 'low-stock-alert': {
        // Alerta de estoque para o DONO DA LOJA
        const { product_name, stock_qty } = job.data;
        const adminPhone = config.whatsapp_number; // Número da loja/admin
        
        if (adminPhone) {
          // Como é do sistema para o dono, pode ser mensagem livre (não precisa de template, assumindo janela de 24h ou número interno)
          await whatsappAPI.sendTextMessage(
            adminPhone, 
            `⚠️ *Alerta de Estoque*\nO produto "${product_name}" está com estoque crítico: apenas ${stock_qty} unidades restantes.`
          );
        }
        break;
      }

      case 'churn-reengagement':
      case 'birthday-coupon': {
        const { phone, template_name, coupon_code } = job.data;
        await whatsappAPI.sendTemplateMessage(phone, template_name, 'pt_BR', [
          { type: 'body', parameters: [{ type: 'text', text: coupon_code || 'PROMO10' }] }
        ]);
        break;
      }

      default:
        console.warn(`[Worker] Job desconhecido: ${job.name}`);
    }

  } catch (error) {
    console.error(`[Worker Error - Job ${job.id}]:`, error);
    throw error; // Lança o erro para o BullMQ fazer o retry automático
  }
}, { 
  connection: redisConnection as any,
  concurrency: 5 // Processa até 5 mensagens simultaneamente
});