import { Queue, Worker } from 'bullmq';

import { PrismaClient as BusinessClient } from '@prisma/business-client';
import { GroqService } from 'src/integrations/openai/groq.service';
import { WhatsAppIntegrationService } from 'src/integrations/whatsapp/whatsappIntegration.service';
import { redisConnection } from 'src/shared/redis/connection';
import { CalendarService } from 'src/modules/business-module/calendar/calendar.service';
import { masterDb } from 'src/database/master';
import { app } from 'src/app';


const aiService = new GroqService();
const whatsappService = new WhatsAppIntegrationService();
const calendarService = new CalendarService();

export const whatsappQueue = new Queue('whatsapp-messages', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 } // Espera 5s, 10s...
  }
});


export const whatsappWorker = new Worker('whatsapp-messages', async job => {
  const { text, from, businessId, businessDbName, businessName } = job.data;
  let dbBusinessClient: BusinessClient | null = null;

  try {
    // 📢 SINAL 1: IA começou a processar a mensagem
    app.io.to(businessId).emit('ai_status', { 
      status: 'processing', 
      message: 'IA está analisando a mensagem do cliente...',
      customer: from 
    });

    // 1. CHECK DE ASSINATURA
    const subscription = await masterDb.subscription.findFirst({
      where: { company_id: businessId },
      orderBy: { created_at: 'desc' }
    });

    const isExpired = subscription && new Date() > subscription.current_period_end;
    const isInactive = !subscription || subscription.status === 'CANCELED' || isExpired;

    if (isInactive) {
      app.io.to(businessId).emit('ai_status', { status: 'error', message: 'Assinatura inativa/vencida.' });
      await whatsappService.sendMessage(from, "Assistente indisponível. Por favor, ligue para a empresa.");
      return;
    }

    dbBusinessClient = new BusinessClient({
      datasources: { businessdb: { url: `${process.env.DATABASE_URL_BASE}${businessDbName}` } }
    });

    // Pegamos o contexto
    const [config, services, employees] = await Promise.all([
      dbBusinessClient.config.findFirst(),
      dbBusinessClient.service.findMany({ where: { is_active: true } }),
      dbBusinessClient.employee.findMany({ where: { is_active: true } })
    ]);

    const context = `Empresa: ${businessName}...`; // contexto abreviado aqui

    // 2. PRIMEIRA CHAMADA À IA
    let aiMessage = await aiService.generateResponse(text, context);

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const toolCall of aiMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        let toolResult = "";

        // 📢 SINAL 2: IA decidiu usar uma ferramenta
        app.io.to(businessId).emit('ai_status', { 
          status: 'tool_calling', 
          tool: toolCall.function.name, 
          args 
        });

        switch (toolCall.function.name) {
          case 'check_availability':
            const availability = await calendarService.getAvailability(dbBusinessClient!, args.employee_id, args.date);
            toolResult = `Horários livres: ${availability.join(', ') || 'Nenhum'}.`;
            
            // 📢 SINAL EXTRA: Notifica que a IA está consultando a agenda
            app.io.to(businessId).emit('calendar_action', { type: 'search', date: args.date });
            break;

          case 'create_appointment':
            let client = await dbBusinessClient!.client.findUnique({ where: { phone: from } });
            if (!client) {
              client = await dbBusinessClient!.client.create({ data: { name: args.client_name, phone: from } });
            }

            const service = await dbBusinessClient!.service.findUnique({ where: { id: args.service_id } });
            const duration = service?.duration_minutes || 30;
            const startTime = new Date(args.start_time);
            const endTime = new Date(startTime.getTime() + duration * 60000);

            const appointment = await dbBusinessClient!.calendar.create({
              data: {
                client_id: client.id,
                employee_id: args.employee_id,
                service_id: args.service_id,
                start_time: startTime,
                end_time: endTime,
                status: 'CONFIRMED'
              }
            });

            toolResult = `Agendamento criado para ${args.client_name}.`;

            // 📢 SINAL EXTRA: Novo agendamento na tela!
            app.io.to(businessId).emit('novo_agendamento', {
              id: appointment.id,
              cliente: args.client_name,
              horario: startTime,
              servico: service?.name
            });
            break;

          case 'list_my_appointments':
            const appointments = await dbBusinessClient!.calendar.findMany({
              where: { client: { phone: from }, status: { in: ['CONFIRMED', 'PENDING'] }, start_time: { gte: new Date() } },
              include: { service: true, employee: true }
            });
            toolResult = appointments.length > 0 ? "Agendamentos encontrados." : "Nenhum futuro.";
            break;

          case 'cancel_appointment':
            await dbBusinessClient!.calendar.update({
              where: { id: args.appointment_id },
              data: { status: 'CANCELED' }
            });
            toolResult = `Cancelado com sucesso.`;

            // 📢 SINAL EXTRA: Remove da tela
            app.io.to(businessId).emit('agendamento_cancelado', { id: args.appointment_id });
            break;
        }

        // 3. RESPOSTA FINAL DA IA
        const finalAiResponse = await aiService.generateResponse(
          `O sistema executou ${toolCall.function.name}: ${toolResult}. Responda ao cliente.`,
          context
        );

        // 📢 SINAL 3: IA terminou e respondeu ao cliente
        app.io.to(businessId).emit('ai_status', { 
          status: 'completed', 
          response: finalAiResponse.content 
        });

        await whatsappService.sendMessage(from, finalAiResponse.content || '');
      }
    } else {
      // Resposta sem ferramentas
      app.io.to(businessId).emit('ai_status', { status: 'completed', response: aiMessage.content });
      await whatsappService.sendMessage(from, aiMessage.content || '');
    }

  } catch (error) {
    app.io.to(businessId).emit('ai_status', { status: 'error', message: 'Erro crítico no processamento.' });
    console.error(`[Worker Error]:`, error);
    throw error;
  } finally {
    if (dbBusinessClient) await dbBusinessClient.$disconnect();
  }
}, { connection: redisConnection as any });