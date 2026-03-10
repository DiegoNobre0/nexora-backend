// src/integrations/groq/groq.service.ts
import Groq from 'groq-sdk';

export class GroqService {
    private client: Groq;

    private readonly tools: any[] = [
        {
            type: 'function',
            function: {
                name: 'check_availability',
                description: 'Consulta os horários livres de um profissional em uma data específica.',
                parameters: {
                    type: 'object',
                    properties: {
                        employee_id: { type: 'string', description: 'ID do profissional' },
                        date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
                    },
                    required: ['employee_id', 'date'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'create_appointment',
                description: 'Cria um novo agendamento no sistema após o cliente confirmar o horário.',
                parameters: {
                    type: 'object',
                    properties: {
                        employee_id: { type: 'string', description: 'ID do profissional escolhido' },
                        service_id: { type: 'string', description: 'ID do serviço escolhido' },
                        start_time: { type: 'string', description: 'Data e hora de início no formato ISO (ex: 2026-03-10T10:00:00Z)' },
                        client_name: { type: 'string', description: 'Nome completo do cliente' },
                    },
                    required: ['employee_id', 'service_id', 'start_time', 'client_name'],
                },
            },
        },

        {
            type: 'function',
            function: {
                name: 'list_my_appointments',
                description: 'Lista os agendamentos futuros que o cliente possui no sistema.',
                parameters: { type: 'object', properties: {} }, // Não precisa de parâmetros, usamos o número do WhatsApp
            },
        },
        {
            type: 'function',
            function: {
                name: 'cancel_appointment',
                description: 'Cancela um agendamento existente para liberar o horário.',
                parameters: {
                    type: 'object',
                    properties: {
                        appointment_id: { type: 'string', description: 'O ID do agendamento a ser cancelado' },
                    },
                    required: ['appointment_id'],
                },
            },
        }
    ];

    constructor() {
        this.client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    async generateResponse(userMessage: string, businessContext: string) {
        try {
            const response = await this.client.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `Você é o assistente virtual do Nexora. 
            Contexto da empresa: ${businessContext}.
            Hoje é dia ${new Date().toLocaleDateString('pt-BR')}.`
                    },
                    { role: 'user', content: userMessage }
                ],
                tools: this.tools as any, // 👈 O 'as any' aqui mata o erro de vez e te deixa trabalhar
                tool_choice: 'auto',
            });

            return response.choices[0].message;
        } catch (error) {
            console.error('[Groq Error]:', error);
            throw error;
        }
    }
}