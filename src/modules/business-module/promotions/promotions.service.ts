import type { BusinessClient } from '../../../database/business-manager';
import { ValidationError } from '../../../shared/errors/AppError';

export class PromotionsService {
  constructor(private readonly db: BusinessClient) {}

  async getActivePromotions() {
    const now = new Date();
    const currentDay = now.getDay().toString(); // 0-6

    const promos = await this.db.promotion.findMany({
      where: {
        is_active: true,
        start_at: { lte: now },
        OR: [
          { end_at: null },
          { end_at: { gte: now } }
        ]
      }
    });

    // Filtra por dia da semana (se houver restrição)
    return promos.filter(p => {
      if (!p.days_of_week) return true;
      return p.days_of_week.split(',').includes(currentDay);
    });
  }

  // Lógica para aplicar os descontos no carrinho
  async applyPromotionsToItems(items: any[]) {
    const activePromos = await this.getActivePromotions();
    let totalDiscount = 0;

    const processedItems = items.map(item => {
      // Procura promo específica para este produto ou para a categoria dele
      const promo = activePromos.find(p => 
        (p.target === 'PRODUCT' && p.product_id === item.product_id) ||
        (p.target === 'CATEGORY' && p.category_id === item.category_id)
      );

      if (promo) {
        let discount = 0;
        if (promo.type === 'PERCENTAGE') {
          discount = item.unit_price * Number(promo.value) * item.quantity;
        } else {
          discount = Number(promo.value) * item.quantity;
        }
        totalDiscount += discount;
        return { ...item, promo_id: promo.id, discount_applied: discount };
      }

      return { ...item, discount_applied: 0 };
    });

    return { processedItems, totalDiscount };
  }
}