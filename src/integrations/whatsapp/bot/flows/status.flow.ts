
import type { WhatsAppIntegrationService } from '../../whatsappIntegration.service';
import type { ChatSession } from '../bot.session';
import { BotContext } from '../bot.context';
import { BusinessClient } from 'src/database/business-manager';

export class StatusFlow {
  private botContext: BotContext;

  constructor(
    private readonly db: BusinessClient,
    private readonly whatsapp: WhatsAppIntegrationService
  ) {
    this.botContext = new BotContext(db);
  }

  async handle(phone: string, session: ChatSession) {
    // Se não tem client_id na sessão, é porque o número não está cadastrado como cliente ainda
    if (!session.client_id) {
      await this.whatsapp.sendTextMessage(
        phone, 
        "Não encontrei nenhum pedido em andamento associado a este número. Posso ajudar com mais alguma coisa?"
      );
      return;
    }

    // Busca os pedidos ativos (pendentes, preparando, em entrega) usando o helper do contexto
    const statusContext = await this.botContext.getActiveOrdersContext(session.client_id);
    
    // Devolve o texto montado direto para o WhatsApp
    await this.whatsapp.sendTextMessage(
      phone, 
      `Aqui está o status das suas compras:\n\n${statusContext}`
    );
  }
}