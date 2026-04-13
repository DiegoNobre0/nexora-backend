import axios, { type AxiosInstance } from 'axios';
import type {
  TemplateComponent,
  InteractiveSection,
  InteractiveButton
} from './whatsapp.types';

// ─────────────────────────────────────────────────────────────
// SERVICE — WhatsApp Integration (Meta Cloud API)
//
// Projetado para ambiente Multi-Tenant. As credenciais devem ser
// passadas na instância para suportar múltiplos clientes.
// ─────────────────────────────────────────────────────────────

export class WhatsAppIntegrationService {
  private readonly http: AxiosInstance;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  /**
   * @param token Token de acesso (Pego na tabela Config da loja, ou .env como fallback)
   * @param phoneId ID do Número de Telefone (Pego na tabela Config da loja)
   */
  constructor(token?: string, phoneId?: string) {
    this.accessToken = token || process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('⚠️ WhatsAppIntegrationService instanciado sem credenciais válidas.');
    }

    // Configura uma instância dedicada do Axios para a Meta
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/v18.0`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ─── 1. Mensagem de Texto Simples ──────────────────────────

  async sendTextMessage(to: string, text: string) {
    return this.sendPayload(to, {
      type: 'text',
      text: { body: text, preview_url: true },
    });
  }

  // ─── 2. Mensagens Interativas (Botões) ─────────────────────
  // Ótimo para Fluxos Rápidos (ex: "Sim" / "Não" / "Falar com Humano")

  async sendInteractiveButtons(to: string, bodyText: string, buttons: InteractiveButton[], headerText?: string) {
    if (buttons.length > 3) {
      throw new Error('A Meta permite no máximo 3 botões por mensagem.');
    }

    const actionButtons = buttons.map(btn => ({
      type: 'reply',
      reply: { id: btn.id, title: btn.title }
    }));

    return this.sendPayload(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(headerText && { header: { type: 'text', text: headerText } }),
        body: { text: bodyText },
        action: { buttons: actionButtons }
      }
    });
  }

  // ─── 3. Mensagens Interativas (Lista) ──────────────────────
  // O menu perfeito para Cardápios, FAQs e seleção de Categoria

  async sendInteractiveList(to: string, bodyText: string, buttonText: string, sections: InteractiveSection[]) {
    return this.sendPayload(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText, // Ex: "Ver Menu"
          sections: sections
        }
      }
    });
  }

  // ─── 4. Mensagem de Template (Ativa) ───────────────────────
  // Obrigatório para iniciar conversas ou enviar notificações (ex: Pedido Enviado) fora da janela de 24h

  async sendTemplateMessage(to: string, templateName: string, languageCode = 'pt_BR', components: TemplateComponent[] = []) {
    return this.sendPayload(to, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components
      }
    });
  }

  // ─── 5. Marcar como Lido (Confirmação visual pro cliente) ──

  async markAsRead(messageId: string) {
    try {
      await this.http.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
      return true;
    } catch (error: any) {
      this.handleMetaError(error, 'Mark as Read');
      return false; // Falha silenciosa para não quebrar a aplicação
    }
  }

  // ─── 6. Download de Mídia (Áudio, Imagem, PDF) ─────────────
  // O Webhook manda só o ID da mídia. Precisamos buscar a URL e depois baixar.

  async downloadMedia(mediaId: string): Promise<Buffer> {
    try {
      // Passo 1: Obter a URL da mídia na Meta
      const response = await this.http.get(`/${mediaId}`);
      const mediaUrl = response.data.url;

      if (!mediaUrl) throw new Error('URL da mídia não retornada pela Meta.');

      // Passo 2: Fazer o download binário do arquivo
      const downloadResponse = await axios.get(mediaUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        responseType: 'arraybuffer', // Essencial para baixar imagens/áudios corretamente
      });

      return Buffer.from(downloadResponse.data, 'binary');
    } catch (error: any) {
      this.handleMetaError(error, 'Download Media');
      throw new Error(`Falha ao fazer download da mídia ${mediaId}`);
    }
  }


  //enviar a mensagem interativa com image
  async sendInteractiveImageMessage(to: string, bodyText: string, imageUrl: string, buttons: { id: string, title: string }[]) {
    return this.sendPayload(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        header: { type: 'image', image: { link: imageUrl } },
        body: { text: bodyText },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
          }))
        }
      }
    });
  }

  // ─── Helper Privado: Motor de Envio Seguro ─────────────────

  private async sendPayload(to: string, payload: any) {
    const cleanPhone = to.replace(/\D/g, ''); // Garante que só vão números

    try {
      const response = await this.http.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        ...payload,
      });

      return response.data;
    } catch (error: any) {
      this.handleMetaError(error, 'Send Payload');
      throw new Error('Falha ao enviar mensagem via WhatsApp API');
    }
  }

  // ─── Helper Privado: Tratamento de Erros da Meta ───────────

  private handleMetaError(error: any, context: string) {
    const metaError = error.response?.data?.error;
    if (metaError) {
      console.error(`[Meta API Error - ${context}]`, {
        message: metaError.message,
        type: metaError.type,
        code: metaError.code,
        details: metaError.error_data?.details || 'Nenhum detalhe extra.',
      });
    } else {
      console.error(`[Network/Unknown Error - ${context}]`, error.message);
    }
  }



}