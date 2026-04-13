import type Groq from 'groq-sdk';

import type { WhatsAppIntegrationService } from '../../whatsappIntegration.service';
import type { ChatSession } from '../bot.session';

import { BusinessClient } from 'src/database/business-manager';
import { LeadsService } from 'src/modules/business-module/leads/leads.service';

export class LeadFlow {
  private leadsService: LeadsService;

  constructor(
    private readonly db: BusinessClient,
    private readonly whatsapp: WhatsAppIntegrationService,
    private readonly groq: Groq
  ) {
    this.leadsService = new LeadsService(db);
  }

  async handle(phone: string, message: string, session: ChatSession) {
    // Garante que o Lead existe no banco
    const lead = await this.leadsService.createLead({ phone, source: 'WHATSAPP' });

    // Usa o LLM para extrair informações (Nome, Interesse) da mensagem do cliente
    const extractInfo = await this.groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Extraia o NOME e o INTERESSE PRINCIPAL da mensagem do usuário e retorne APENAS um JSON válido.
Formato: {"name": "Nome ou nulo", "interest": "Interesse ou nulo"}`
        },
        { role: "user", content: message }
      ],
      model: "llama3-8b-8192",
      response_format: { type: "json_object" }
    });

    try {
      const extracted = JSON.parse(extractInfo.choices[0]?.message?.content || '{}');
      
      // Atualiza o Lead e roda o motor de SCORING automático
      if (extracted.name || extracted.interest) {
        await this.leadsService.captureLeadData(lead.id, {
          name: extracted.name,
          interest: extracted.interest
        });
      }
    } catch (e) {
      console.error('Falha ao extrair dados do lead', e);
    }

    // Se ainda não sabe o nome, pede educadamente
    if (!session.lead_id) { // Hack simples: se não tinha lead_id na sessão, é o primeiro contato
      await this.whatsapp.sendTextMessage(phone, "Olá! Bem-vindo. Para eu poder te atender melhor, como posso te chamar?");
    } else {
      // Responde normalmente
      await this.whatsapp.sendTextMessage(phone, "Certo! Como posso te ajudar hoje?");
    }
  }
}