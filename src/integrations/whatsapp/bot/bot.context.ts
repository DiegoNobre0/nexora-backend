import { BusinessClient } from "src/database/business-manager";
import { PromotionsService } from "src/modules/business-module/promotions/promotions.service";


export class BotContext {
    constructor(private readonly db: BusinessClient) { }

    // Busca categorias e produtos ativos, formatando em texto simples para economizar tokens
    async getMenuContext(): Promise<string> {
        const categories = await this.db.category.findMany({
            where: { is_active: true },
            include: {
                products: {
                    where: { is_active: true, stock_qty: { gt: 0 } }, // Só produtos com estoque
                    select: { name: true, description: true, price: true, unit: true }
                }
            }
        });

        if (categories.length === 0) return 'O cardápio está vazio no momento.';

        let menuText = '=== NOSSO CARDÁPIO ===\n\n';

        categories.forEach((cat: any) => {
            if (cat.products.length === 0) return;
            menuText += `[Categoria: ${cat.name}]\n`;
            cat.products.forEach((p: any) => {
                menuText += `- ${p.name} (R$ ${Number(p.price).toFixed(2)} por ${p.unit})\n`;
                if (p.description) menuText += `  Detalhes: ${p.description}\n`;
            });
            menuText += '\n';
        });

        return menuText;
    }

    async getActiveOrdersContext(clientId: string): Promise<string> {
        const orders = await this.db.order.findMany({
            where: { client_id: clientId, status: { notIn: ['DELIVERED', 'CANCELED'] } },
            select: { id: true, status: true, total: true }
        });

        if (orders.length === 0) return 'O cliente não possui pedidos em andamento.';

        return orders.map((order: any) => `Pedido #${order.id.split('-')[0]} | Status: ${order.status} | Total: R$ ${Number(order.total).toFixed(2)}`).join('\n');
    }


    async getActivePromotionsContext(): Promise<string> {
        const promoService = new PromotionsService(this.db);
        const promos = await promoService.getActivePromotions();

        if (promos.length === 0) return "";

        let text = "\n🔥 PROMOÇÕES ATIVAS DE HOJE:\n";
        promos.forEach((p: any) => {
            const desc = p.type === 'PERCENTAGE' ? `${Number(p.value) * 100}% de desconto` : `R$ ${p.value} de desconto`;
            text += `- ${p.name}: ${desc} em ${p.description || 'itens selecionados'}\n`;
        });

        return text;
    }


    // ─────────────────────────────────────────────────────────────
// bot.context.ts (Trecho para Kits)
// ─────────────────────────────────────────────────────────────

async getPromoKitsContext(): Promise<string> {
  const now = new Date();
  
  // Busca os kits ativos no banco do Tenant
  const activeKits = await this.db.promoKit.findMany({
    where: {
      is_active: true,
      start_at: { lte: now },
      OR: [
        { end_at: null },
        { end_at: { gte: now } }
      ]
    },
    include: { items: { include: { product: { select: { name: true } } } } },
    take: 4 // Pegamos os 4 principais para não estourar o prompt
  });

  if (activeKits.length === 0) return "";

  let text = "\n💎 KITS PROMOCIONAIS IMPERDÍVEIS DE HOJE:\n";
  activeKits.forEach((kit: any) => {
    const itemsList = kit.items.map((i: any) => `${i.quantity}x ${i.product.name}`).join(', ');
    text += `- ✨ ${kit.name}: Apenas R$ ${Number(kit.price).toFixed(2)}!\n`;
    text += `  Descrição: ${kit.description || 'Confira esta oferta.'}\n`;
    text += `  Composição: ${itemsList}\n`;
    
    // Se tiver imagem principal, dizemos à IA que ela pode enviar
    if (kit.image_url_1) {
      text += `  (ID_IMAGEM_PARA_ENVIO: ${kit.id})\n`; // Usamos o ID do kit como referência
    }
    text += '\n';
  });

  return text;
}
}