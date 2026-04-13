import { BusinessClient } from "src/database/business-manager";


export class BotContext {
  constructor(private readonly db: BusinessClient) {}

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
    
    categories.forEach(cat => {
      if (cat.products.length === 0) return;
      menuText += `[Categoria: ${cat.name}]\n`;
      cat.products.forEach(p => {
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

    return orders.map(o => `Pedido #${o.id.split('-')[0]} | Status: ${o.status} | Total: R$ ${Number(o.total).toFixed(2)}`).join('\n');
  }
}