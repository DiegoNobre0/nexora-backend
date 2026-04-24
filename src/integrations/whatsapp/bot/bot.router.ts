import Groq from 'groq-sdk';

import { BotSession } from './bot.session';
import { BotContext } from './bot.context';
import { WhatsAppIntegrationService } from '../whatsappIntegration.service';
import { ConfigsService } from 'src/modules/business-module/configs/configs.service';
import { BusinessClient } from 'src/database/business-manager';
import { OrderFlow } from './flows/order.flow';
import { LeadFlow } from './flows/lead.flow';
import { StatusFlow } from './flows/status.flow';
import { FAQFlow } from './flows/faq.flow';

// Fluxos


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export class BotRouter {
  private configService: ConfigsService;
  private whatsappAPI: WhatsAppIntegrationService;

  constructor(
    private readonly db: BusinessClient,
    private readonly companyId: string,
    private readonly businessToken: string,
    private readonly businessPhoneId: string
  ) {
    this.configService = new ConfigsService(db);
    this.whatsappAPI = new WhatsAppIntegrationService(this.businessToken, this.businessPhoneId);
  }

  async handleMessage(phone: string, text: string, clientId: string | null) {
    const sessionManager = new BotSession(this.companyId, phone);
    let session = await sessionManager.get();

    if (!session) {
      session = await sessionManager.save({ phone, client_id: clientId });
    }

    // 1. Verificação de Handoff (Se o humano assumiu, o bot se cala)
    if (session.is_human_handoff) {
      return; 
    }

    // 2. Verificação de Horário de Funcionamento
    const isOpen = await this.configService.isWithinOperatingHours();
    if (!isOpen) {
      const outOfHoursMsg = await this.configService.getOutOfHoursMessage();
      await this.whatsappAPI.sendTextMessage(phone, outOfHoursMsg);
      return;
    }

    // 3. Detecção de Intenção Rápida (Usa LLM para classificar)
    const intent = await this.detectIntent(text);

    // 4. Roteamento para o fluxo correto
    switch (intent) {
      case 'ORDER':
        const orderFlow = new OrderFlow(this.db, this.whatsappAPI, groq);
        await orderFlow.handle(phone, text, session);
        break;
      
      case 'STATUS':
        const statusFlow = new StatusFlow(this.db, this.whatsappAPI);
        await statusFlow.handle(phone, session);
        break;

      case 'HUMAN_HANDOFF':
        await sessionManager.escalateToHuman();
        await this.whatsappAPI.sendTextMessage(phone, "Certo! Estou transferindo você para um de nossos atendentes. Aguarde um instante.");
        break;

      case 'FAQ':
      default:
        // Se for cliente não cadastrado e intenção não for clara, manda pro fluxo de Lead (Captação)
        if (!clientId) {
          const leadFlow = new LeadFlow(this.db, this.whatsappAPI, groq);
          await leadFlow.handle(phone, text, session);
        } else {
          const faqFlow = new FAQFlow(this.db, this.whatsappAPI, groq);
          await faqFlow.handle(phone, text);
        }
        break;
    }
  }

  // ─── Motor Rápido de Detecção de Intenção ──────────────────

  private async detectIntent(message: string): Promise<'ORDER' | 'STATUS' | 'FAQ' | 'HUMAN_HANDOFF'> {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `Você é um roteador de intenções de um comércio local.
Sua única função é classificar a mensagem do cliente em UMA das opções abaixo. 
Responda APENAS com a palavra da opção, sem pontuação.

Opções:
- ORDER (O cliente quer ver o cardápio, comprar algo, perguntou preço de produto ou quer fazer pedido)
- STATUS (O cliente quer saber onde está o pedido, rastrear, perguntou se já saiu)
- HUMAN_HANDOFF (O cliente pediu explicitamente para falar com uma pessoa, atendente, humano, ou fez uma reclamação grave)
- FAQ (Perguntas gerais, endereço, horário de funcionamento, formas de pagamento ou apenas "Oi")`
          },
          { role: "user", content: message }
        ],
        model: "llama3-8b-8192", // Usa um modelo menor e hiper-rápido só para classificar
        temperature: 0.1,
      });

      const result = completion.choices[0]?.message?.content?.trim().toUpperCase() || 'FAQ';
      
      if (['ORDER', 'STATUS', 'HUMAN_HANDOFF', 'FAQ'].includes(result)) {
        return result as any;
      }
      return 'FAQ';
    } catch (error) {
      console.error('[Intent Detection Error]:', error);
      return 'FAQ'; // Fallback seguro
    }
  }
}