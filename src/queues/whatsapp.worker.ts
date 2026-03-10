import { Queue, Worker } from 'bullmq';

import { PrismaClient as BusinessClient } from '@prisma/business-client';
import { GroqService } from 'src/integrations/openai/groq.service';
import { WhatsAppIntegrationService } from 'src/integrations/whatsapp/whatsappIntegration.service';
import { redisConnection } from 'src/shared/redis/connection';
import { CalendarService } from 'src/modules/business-module/calendar/calendar.service';


const aiService = new GroqService();
const whatsappService = new WhatsAppIntegrationService();
const calendarService = new CalendarService();

export const whatsappQueue = new Queue('whatsapp-messages', { 
  connection: redisConnection as any 
});

export const whatsappWorker = new Worker('whatsapp-messages', async job => {
  const { text, from, businessId, tenantDbName, businessName } = job.data;
  let db: BusinessClient | null = null;

  try {
    db = new BusinessClient({
      datasources: { businessdb: { url: `${process.env.DATABASE_URL_BASE}${tenantDbName}` } }
    });

    // 1. Pegamos o contexto (Serviços e Profissionais)
    const [config, services, employees] = await Promise.all([
      db.config.findFirst(),
      db.service.findMany({ where: { is_active: true } }),
      db.employee.findMany({ where: { is_active: true } })
    ]);

    const context = `
      Empresa: ${businessName}
      Profissionais: ${employees.map(e => `${e.name} (ID: ${e.id})`).join(', ')}
      Serviços: ${services.map(s => `${s.name} - R$${s.price}`).join(', ')}
      Prompt: ${config?.ai_prompt}
    `;

    // 2. Primeira chamada à IA (Ela decide se precisa de ferramenta)
    let aiMessage = await aiService.generateResponse(text, context);

    // 3. Se a IA quiser usar uma ferramenta (ex: check_availability)
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const toolCall of aiMessage.tool_calls) {
        if (toolCall.function.name === 'check_availability') {
          const args = JSON.parse(toolCall.function.arguments);
          
          console.log(`[Worker] IA consultando disponibilidade para ${args.date}`);

          // EXECUTAMOS A SUA FUNÇÃO REAL DO CALENDAR SERVICE
          const availability = await calendarService.getAvailability(
            db, 
            args.employee_id, 
            args.date
          );

          // 4. Enviamos o resultado de volta para a IA para ela dar a resposta final
          const secondContext = `O cliente perguntou: "${text}". O sistema retornou estes horários livres: ${availability.join(', ') || 'Nenhum horário disponível'}. Responda ao cliente com base nisso.`;
          
          const finalAiResponse = await aiService.generateResponse(secondContext, context);
          
          await whatsappService.sendMessage(from, finalAiResponse.content || '');
        }
      }
    } else {
      // Resposta direta se não houver necessidade de ferramenta
      await whatsappService.sendMessage(from, aiMessage.content || '');
    }

  } catch (error) {
    console.error('[Worker Error]:', error);
  } finally {
    if (db) await db.$disconnect();
  }
}, { connection: redisConnection as any });