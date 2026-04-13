import Groq from 'groq-sdk';

// ─────────────────────────────────────────────────────────────
// SERVICE — Groq (IA Engine)
//
// Refatorado para E-commerce: Consulta de estoque, preços,
// status de pedidos e captura de leads.
// ─────────────────────────────────────────────────────────────

export class GroqService {
  private client: Groq;

  // Definição de ferramentas (Tools) para o modelo de E-commerce
  private readonly tools: any[] = [
    {
      type: 'function',
      function: {
        name: 'check_product_availability',
        description: 'Consulta o preço e a disponibilidade de um produto no estoque.',
        parameters: {
          type: 'object',
          properties: {
            product_name: { type: 'string', description: 'Nome ou palavra-chave do produto' },
          },
          required: ['product_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_order_status',
        description: 'Lista o status dos pedidos recentes do cliente para rastreamento.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_store_info',
        description: 'Obtém informações gerais da loja como endereço, horário de funcionamento e formas de pagamento.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'capture_lead_interest',
        description: 'Registra o interesse específico de um cliente em um produto ou categoria para o CRM.',
        parameters: {
          type: 'object',
          properties: {
            interest: { type: 'string', description: 'O que o cliente deseja ou procura (ex: Churrasco, Bebidas)' },
            customer_name: { type: 'string', description: 'Nome do cliente, se fornecido' },
          },
          required: ['interest'],
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
            content: `Você é o especialista de vendas virtual da plataforma Nexora.
            
            DIRETRIZES DE ATENDIMENTO:
            1. Use o contexto da empresa para responder: ${businessContext}.
            2. Seja cordial, use emojis e foque em converter a conversa em venda.
            3. Se o cliente demonstrar interesse em algo, use a ferramenta 'capture_lead_interest'.
            4. Se o cliente perguntar sobre produtos, use 'check_product_availability'.
            
            Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
          },
          { role: 'user', content: userMessage }
        ],
        tools: this.tools as any,
        tool_choice: 'auto',
        temperature: 0.5, // Menos criatividade, mais precisão comercial
      });

      return response.choices[0].message;
    } catch (error) {
      console.error('[Groq Error]:', error);
      throw error;
    }
  }
}