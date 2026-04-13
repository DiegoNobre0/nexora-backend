import type Groq from 'groq-sdk';

import type { WhatsAppIntegrationService } from '../../whatsappIntegration.service';
import { BusinessClient } from 'src/database/business-manager';
import { ConfigsService } from 'src/modules/business-module/configs/configs.service';


export class FAQFlow {
  private configService: ConfigsService;

  constructor(
    private readonly db: BusinessClient,
    private readonly whatsapp: WhatsAppIntegrationService,
    private readonly groq: Groq
  ) {
    this.configService = new ConfigsService(db);
  }

  async handle(phone: string, message: string) {
    // 1. Busca a configuração do banco (Para pegar o prompt personalizado da loja)
    const config = await this.configService.getConfig();

    // 2. Chama o LLM passando as diretrizes da empresa
    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Você é o assistente virtual desta loja. 
Siga estritamente esta instrução do dono do estabelecimento:
"${config.ai_prompt || 'Seja educado, prestativo e responda de forma curta.'}"

Se o cliente perguntar algo que não saiba, não invente. Diga que pode transferir para um atendente.`
        },
        // TODO: Aqui também idealmente injetaríamos as últimas 5 mensagens do Redis para contexto
        { role: "user", content: message }
      ],
      model: "llama3-8b-8192", // Usamos o modelo 8b aqui porque perguntas frequentes exigem respostas mais rápidas
      temperature: 0.3,
    });

    const botResponse = completion.choices[0]?.message?.content || "Como posso te ajudar hoje?";

    // 3. Envia a resposta gerada de volta para o cliente
    await this.whatsapp.sendTextMessage(phone, botResponse);
  }
}