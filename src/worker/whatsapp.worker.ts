import { Queue, Worker } from 'bullmq';

import { PrismaClient as BusinessClient } from '@prisma/business-client';
import { GroqService } from 'src/integrations/openai/groq.service';
import { WhatsAppIntegrationService } from 'src/integrations/whatsapp/whatsappIntegration.service';
import { redisConnection } from 'src/shared/redis/connection';
import { CalendarService } from 'src/modules/business-module/calendar/calendar.service';
import { masterDb } from 'src/database/master';


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

    // 1. CHECK DE ASSINATURA (No Banco Master)
    const subscription = await masterDb.subscription.findFirst({
      where: { company_id: businessId },
      orderBy: { created_at: 'desc' }
    });

    const isExpired = subscription && new Date() > subscription.current_period_end;
    const isInactive = !subscription || subscription.status === 'CANCELED' || isExpired;


    if (isInactive) {
      console.log(`[Worker] Bloqueado: Empresa ${businessId} com assinatura inválida.`);
      await whatsappService.sendMessage(from, 
        "Olá! O assistente virtual desta empresa está temporariamente indisponível. Por favor, tente o contato por ligação."
      );
      return; 
    }

    dbBusinessClient = new BusinessClient({
      datasources: { businessdb: { url: `${process.env.DATABASE_URL_BASE}${businessDbName}` } }
    });

    // 1. Pegamos o contexto (Serviços e Profissionais)
    const [config, services, employees] = await Promise.all([
      dbBusinessClient.config.findFirst(),
      dbBusinessClient.service.findMany({ where: { is_active: true } }),
      dbBusinessClient.employee.findMany({ where: { is_active: true } })
    ]);

    const context = `
      Empresa: ${businessName}
      Profissionais: ${employees.map(e => `${e.name} (ID: ${e.id})`).join(', ')}
      Serviços: ${services.map(s => `${s.name} - R$${s.price}`).join(', ')}
      Prompt: ${config?.ai_prompt}
    `;

    // 2. Primeira chamada à IA (Ela decide se precisa de ferramenta)
    let aiMessage = await aiService.generateResponse(text, context);

    // 3. Se a IA quiser usar uma ferramenta 
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const toolCall of aiMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        let toolResult = ""; // Variável para guardar o que aconteceu

        // 1. EXECUÇÃO DAS FERRAMENTAS
        switch (toolCall.function.name) {

          case 'check_availability':
            console.log(`[Worker] Consultando agenda: ${args.date}`);
            const availability = await calendarService.getAvailability(dbBusinessClient!, args.employee_id, args.date);
            toolResult = `Horários livres encontrados: ${availability.join(', ') || 'Nenhum horário disponível para esta data'}.`;
            break;

          case 'create_appointment':
            // Busca/Cria cliente
            let client = await dbBusinessClient!.client.findUnique({ where: { phone: from } });
            if (!client) {
              client = await dbBusinessClient!.client.create({ data: { name: args.client_name, phone: from } });
            }

            // Calcula tempos
            const service = await dbBusinessClient!.service.findUnique({ where: { id: args.service_id } });
            const duration = service?.duration_minutes || 30;
            const startTime = new Date(args.start_time);
            const endTime = new Date(startTime.getTime() + duration * 60000);

            // Salva no banco
            await dbBusinessClient!.calendar.create({
              data: {
                client_id: client.id,
                employee_id: args.employee_id,
                service_id: args.service_id,
                start_time: startTime,
                end_time: endTime,
                status: 'CONFIRMED'
              }
            });
            toolResult = `Agendamento criado com sucesso para ${args.client_name} em ${startTime.toLocaleString('pt-BR')}.`;
            break;

          case 'list_my_appointments':
            const appointments = await dbBusinessClient!.calendar.findMany({
              where: { client: { phone: from }, status: { in: ['CONFIRMED', 'PENDING'] }, start_time: { gte: new Date() } },
              include: { service: true, employee: true }
            });
            toolResult = appointments.length > 0
              ? `O cliente tem os seguintes agendamentos: ${appointments.map(a => `${a.service.name} com ${a.employee.name} em ${a.start_time.toLocaleString('pt-BR')} (ID: ${a.id})`).join('; ')}`
              : "O cliente não possui agendamentos futuros.";
            break;

          case 'cancel_appointment':
            await dbBusinessClient!.calendar.update({
              where: { id: args.appointment_id },
              data: { status: 'CANCELED' }
            });
            toolResult = `O agendamento ${args.appointment_id} foi cancelado com sucesso. O horário agora está livre.`;
            break;
        }

        // 2. RESPOSTA FINAL DA IA (O "Toque Humano")
        // Passamos o que o sistema fez para a IA comentar com o usuário
        const finalAiResponse = await aiService.generateResponse(
          `O usuário perguntou: "${text}". O sistema executou a função ${toolCall.function.name} e o resultado foi: ${toolResult}. Responda ao cliente de forma natural confirmando a ação ou informando os dados.`,
          context
        );

        await whatsappService.sendMessage(from, finalAiResponse.content || '');
      }
    } else {
      // Resposta normal para conversas que não envolvem ferramentas
      await whatsappService.sendMessage(from, aiMessage.content || '');
    }

  } catch (error) {
    console.error(`[Worker Error - Job ${job.id}]:`, error);

    if (job.attemptsMade >= 2) {
      await whatsappService.sendMessage(from, "Desculpe, tive uma falha técnica ao acessar a agenda. 🛠️ Por favor, tente novamente em um instante.");
    }

    throw error; // Lança o erro para o BullMQ tentar novamente

  } finally {
    if (dbBusinessClient) await dbBusinessClient.$disconnect();
  }
}, { connection: redisConnection as any });