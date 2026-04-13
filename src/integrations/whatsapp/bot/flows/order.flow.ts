import type Groq from 'groq-sdk';

import type { WhatsAppIntegrationService } from '../../whatsappIntegration.service';
import type { ChatSession } from '../bot.session';
import { BotContext } from '../bot.context';
import { BusinessClient } from 'src/database/business-manager';

export class OrderFlow {
  private botContext: BotContext;

  constructor(
    private readonly db: BusinessClient,
    private readonly whatsapp: WhatsAppIntegrationService,
    private readonly groq: Groq
  ) {
    this.botContext = new BotContext(db);
  }

  async handle(phone: string, message: string, session: ChatSession) {
    // 1. Pega o catálogo atualizado
    const menu = await this.botContext.getMenuContext();

    // 2. Pede pro LLM agir como vendedor baseado no cardápio
    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Você é um vendedor simpático de comércio local via WhatsApp.
Baseie-se EXCLUSIVAMENTE no cardápio abaixo. Não invente produtos ou preços.
Seja muito breve, use emojis e ajude o cliente a montar o pedido.

${menu}`
        },
        // TODO: Aqui idealmente puxamos o histórico do Redis para o LLM ter contexto da conversa
        { role: "user", content: message }
      ],
      model: "llama3-70b-8192", // Modelo maior para conversação fluída
      temperature: 0.5,
    });

    const botResponse = completion.choices[0]?.message?.content || 'Desculpe, não entendi. Quer ver nosso cardápio?';

    // 3. Envia a resposta de texto
    await this.whatsapp.sendTextMessage(phone, botResponse);

    // 4. Se o LLM percebeu que o pedido está pronto (podemos usar function calling para isso depois),
    // mandamos botões de confirmar.
    if (botResponse.toLowerCase().includes('confirmar o pedido')) {
       await this.whatsapp.sendInteractiveButtons(phone, "Tudo certo para fechar o pedido?", [
         { id: "BTN_CONFIRMAR", title: "✅ Sim, fechar" },
         { id: "BTN_CANCELAR", title: "❌ Cancelar" }
       ]);
    }
  }
}