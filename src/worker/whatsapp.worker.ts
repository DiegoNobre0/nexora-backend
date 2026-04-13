import { Worker, type Job } from 'bullmq';
import { app } from 'src/app';
import { getBusinessClient } from 'src/database/business-manager';
import { masterDb } from 'src/database/master';
import { WhatsAppIntegrationService } from 'src/integrations/whatsapp/whatsappIntegration.service';
import { GroqService } from 'src/integrations/openai/groq.service';
import { redisConnection } from 'src/shared/redis/connection';

// Importamos os services de negócio
import { ProductsService } from 'src/modules/business-module/products/products.service';
import { OrdersService } from 'src/modules/business-module/orders/orders.service';
import { LeadsService } from 'src/modules/business-module/leads/leads.service';

const aiService = new GroqService();

export const whatsappWorker = new Worker('whatsapp-queue', async (job: Job) => {
  const { company_id, business_db_name } = job.data;
  
  if (!company_id || !business_db_name) throw new Error('Dados de roteamento ausentes.');

  try {
    // 1. Validação de Assinatura
    const company = await masterDb.company.findUnique({ 
      where: { id: company_id },
      include: { subscriptions: { orderBy: { created_at: 'desc' }, take: 1 } }
    });

    const sub = company?.subscriptions[0];
    const isInactive = !company?.is_active || !sub || sub.status === 'CANCELED' || (new Date() > sub.current_period_end);

    if (isInactive) return console.warn(`[Worker] Tenant ${business_db_name} inativo.`);

    // 2. Setup do Contexto do Tenant (Banco da Empresa)
    const businessDb = getBusinessClient(business_db_name);
    const config: any = await businessDb.config.findFirst();

    if (!config?.whatsapp_token) throw new Error(`Configurações de WhatsApp ausentes.`);

    const whatsappAPI = new WhatsAppIntegrationService(config.whatsapp_token, config.whatsapp_phone_id);

    // 3. Roteador de Jobs
    switch (job.name) {
      
      case 'lead-flow':
      case 'client-flow': {
        const { phone, message, client_id } = job.data;

        // Dashboard Update
        app.io.to(company_id).emit('chat_status', { phone, status: 'processing' });

        // --- ENRIQUECIMENTO DE CONTEXTO (Kits e Promos) ---
        // Buscamos os kits ativos para a IA saber que eles existem antes mesmo de perguntar
        const activeKits = await businessDb.promoKit.findMany({
          where: { is_active: true },
          take: 4,
          select: { id: true, name: true, price: true, description: true }
        });

        const kitsContext = activeKits.length > 0 
          ? `Kits Disponíveis hoje: ${activeKits.map(k => `${k.name} por R$${k.price}`).join(', ')}.`
          : "Nenhum kit promocional ativo no momento.";

        const businessContext = `Loja: ${company.name}. Endereço: ${config.address || 'Não informado'}. ${kitsContext}`;

        // --- PRIMEIRA CHAMADA À IA ---
        let aiResponse = await aiService.generateResponse(message.content, businessContext);

        // --- LOOP DE FERRAMENTAS (Tools) ---
        if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
          const toolResults = [];

          for (const toolCall of aiResponse.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            let result = "";

            switch (toolCall.function.name) {
              case 'check_product_availability': {
                const pService = new ProductsService(businessDb);
                const products = await pService.listProducts({ name: args.product_name, limit: 3, page: 1 });
                result = products.data.length > 0 
                  ? JSON.stringify(products.data.map(p => ({ id: p.id, name: p.name, price: p.price, stock: p.stock_qty })))
                  : "Produto não encontrado.";
                break;
              }

              case 'list_order_status': {
                const oService = new OrdersService(businessDb);
                const orders = await oService.listOrders({ client_id: client_id, limit: 3, page: 1 });
                result = JSON.stringify(orders.data.map(o => ({ id: o.id, status: o.status, total: o.total })));
                break;
              }

              case 'get_promo_kits': {
                // Ferramenta específica para detalhar os kits (com fotos)
                const kits = await businessDb.promoKit.findMany({ where: { is_active: true }, include: { items: true } });
                result = JSON.stringify(kits);
                break;
              }

              case 'capture_lead_interest': {
                const lService = new LeadsService(businessDb);
                await lService.createLead({ phone, source: 'WHATSAPP' });
                result = "Interesse registrado.";
                break;
              }
            }

            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: toolCall.function.name,
              content: result,
            });
          }

          // Segunda chamada para consolidar a resposta
          const finalPrompt = `Resultado das ferramentas: ${JSON.stringify(toolResults)}. Se for sugerir um Kit, inclua o código [KIT_ID: id_do_kit] no final da resposta.`;
          aiResponse = await aiService.generateResponse(finalPrompt, businessContext);
        }

        // --- INTERCEPTAÇÃO VISUAL (KIT COM FOTO) ---
        // Verificamos se a IA incluiu a tag de Kit na resposta
        const kitTagMatch = aiResponse.content?.match(/\[KIT_ID:\s*([\w-]+)\]/);
        const finalContent = aiResponse.content?.replace(/\[KIT_ID:.*?\]/g, '').trim() || "";

        if (kitTagMatch && kitTagMatch[1]) {
          const kitId = kitTagMatch[1];
          const kitData = await businessDb.promoKit.findUnique({ where: { id: kitId } });

          if (kitData && kitData.image_url_1) {
            // Envia Mensagem Interativa com Imagem do Kit
            await whatsappAPI.sendInteractiveImageMessage(phone, finalContent, kitData.image_url_1, [
              { id: `BUY_KIT_${kitId}`, title: '🛒 Comprar Agora' },
              { id: 'VIEW_MENU', title: '📋 Ver Cardápio' }
            ]);
          } else {
            await whatsappAPI.sendTextMessage(phone, finalContent);
          }
        } else {
          // Envio de texto normal se não houver Kit
          await whatsappAPI.sendTextMessage(phone, finalContent || "Como posso te ajudar?");
        }
        
        app.io.to(company_id).emit('chat_status', { phone, status: 'replied' });
        break;
      }

      // --- OUTROS JOBS ---
      case 'order-notification': {
        const { phone, order_id, template_name } = job.data;
        await whatsappAPI.sendTemplateMessage(phone, template_name, 'pt_BR', [
          { type: 'body', parameters: [{ type: 'text', text: order_id }] }
        ]);
        break;
      }

      case 'low-stock-alert': {
        const { product_name, stock_qty } = job.data;
        if (config.whatsapp_number) {
          await whatsappAPI.sendTextMessage(config.whatsapp_number, `⚠️ *Estoque Baixo*: ${product_name} tem apenas ${stock_qty} un.`);
        }
        break;
      }
    }

  } catch (error) {
    console.error(`[Worker Critical Error]:`, error);
    throw error;
  }
}, { connection: redisConnection as any, concurrency: 5 });