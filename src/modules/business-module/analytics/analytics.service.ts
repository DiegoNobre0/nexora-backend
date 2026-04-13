import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError } from '../../../shared/errors/AppError';

// ─────────────────────────────────────────────────────────────
// SERVICE — Analytics & Reports
//
// Agregações financeiras, inteligência de vendas e CRM.
// ─────────────────────────────────────────────────────────────

export class AnalyticsService {
  constructor(private readonly db: BusinessClient) {}

  // ─── 1. Vendas e Produtos ──────────────────────────────────

  async getTopSellingProducts(startDate: Date, endDate: Date) {
    // 1. Agrupa os itens vendidos e soma a quantidade
    const topSales = await this.db.orderItem.groupBy({
      by: ['product_id'],
      _sum: { quantity: true, total: true },
      where: {
        order: { 
          created_at: { gte: startDate, lte: endDate },
          status: { notIn: ['CANCELED'] },
          is_proforma: false,
        }
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    // 2. Busca os nomes dos produtos para enriquecer o relatório
    const productIds = topSales.map(s => s.product_id);
    const products = await this.db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stock_qty: true }
    });

    return topSales.map(sale => {
      const product = products.find(p => p.id === sale.product_id);
      return {
        product_id: sale.product_id,
        name: product?.name || 'Produto Excluído',
        current_stock: product?.stock_qty || 0,
        quantity_sold: sale._sum.quantity || 0,
        revenue: Number(sale._sum.total || 0).toFixed(2)
      };
    });
  }

  async getRevenueByChannel(startDate: Date, endDate: Date) {
    const channels = await this.db.order.groupBy({
      by: ['channel'],
      _sum: { total: true },
      _count: { id: true },
      where: {
        created_at: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELED'] },
        is_proforma: false,
      }
    });

    return channels.map(c => ({
      channel: c.channel,
      orders_count: c._count.id,
      revenue: Number(c._sum.total || 0).toFixed(2)
    }));
  }

  async getDemandForecast(productId: string, daysToForecast: number) {
    const product = await this.db.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Produto');

    // Pega as vendas dos últimos 30 dias para base de cálculo
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesHistory = await this.db.orderItem.aggregate({
      _sum: { quantity: true },
      where: {
        product_id: productId,
        order: { created_at: { gte: thirtyDaysAgo }, status: { notIn: ['CANCELED'] } }
      }
    });

    const totalSoldLast30Days = salesHistory._sum.quantity || 0;
    const dailyAverage = totalSoldLast30Days / 30;
    
    // Previsão Linear Simples
    const projectedDemand = Math.ceil(dailyAverage * daysToForecast);
    const stockWillRunOut = product.stock_qty < projectedDemand;

    return {
      product_name: product.name,
      current_stock: product.stock_qty,
      daily_average_sales: dailyAverage.toFixed(2),
      forecast_days: daysToForecast,
      projected_demand: projectedDemand,
      stock_status: stockWillRunOut ? 'CRITICAL' : 'OK',
      suggested_restock: stockWillRunOut ? projectedDemand - product.stock_qty : 0
    };
  }

  // ─── 2. CRM e Funil do Bot ─────────────────────────────────

  async getBotConversionFunnel(startDate: Date, endDate: Date) {
    const [totalLeads, contacted, converted] = await Promise.all([
      // Topo do Funil: Todos os leads que entraram
      this.db.lead.count({ where: { created_at: { gte: startDate, lte: endDate } } }),
      // Meio do Funil: Leads que interagiram ou engajaram
      this.db.lead.count({ where: { created_at: { gte: startDate, lte: endDate }, status: { notIn: ['NEW'] } } }),
      // Fundo do Funil: Leads que viraram clientes
      this.db.lead.count({ where: { created_at: { gte: startDate, lte: endDate }, status: 'CONVERTED' } }),
    ]);

    const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(2) : 0;

    return {
      funnel: {
        top_total_leads: totalLeads,
        middle_engaged: contacted,
        bottom_converted: converted,
      },
      conversion_rate_percentage: `${conversionRate}%`
    };
  }

  async getAverageResolutionTime(startDate: Date, endDate: Date) {
    // Calcula o tempo médio entre o Lead entrar (NEW) e ser convertido (CONVERTED)
    const convertedLeads = await this.db.lead.findMany({
      where: { 
        status: 'CONVERTED', 
        converted_at: { not: null },
        created_at: { gte: startDate, lte: endDate }
      },
      select: { created_at: true, converted_at: true }
    });

    if (convertedLeads.length === 0) return { average_minutes: 0, message: "Sem dados suficientes." };

    let totalMinutes = 0;
    convertedLeads.forEach(lead => {
      const diffMs = lead.converted_at!.getTime() - lead.created_at.getTime();
      totalMinutes += Math.round(diffMs / 60000);
    });

    const avgMinutes = Math.round(totalMinutes / convertedLeads.length);

    return {
      total_converted_leads: convertedLeads.length,
      average_conversion_time_minutes: avgMinutes,
      formatted_time: avgMinutes > 60 ? `${(avgMinutes / 60).toFixed(1)} horas` : `${avgMinutes} minutos`
    };
  }

  async getCustomerLifetimeValue(clientId: string) {
    const client = await this.db.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundError('Cliente');

    const stats = await this.db.order.aggregate({
      _sum: { total: true },
      _count: { id: true },
      where: { client_id: clientId, status: { notIn: ['CANCELED'] } }
    });

    const totalRevenue = Number(stats._sum.total || 0);
    const orderCount = stats._count.id;
    const ticketMedio = orderCount > 0 ? totalRevenue / orderCount : 0;

    return {
      client_name: client.type === 'PF' ? client.name : client.company_name,
      orders_count: orderCount,
      lifetime_value: totalRevenue.toFixed(2),
      average_ticket: ticketMedio.toFixed(2),
      loyalty_points: client.loyalty_points
    };
  }

  // ─── 3. Financeiro e Contábil ──────────────────────────────

  async getSimplifiedDRE(startDate: Date, endDate: Date) {
    // DRE: Demonstrativo de Resultados do Exercício (Simplificado)

    // 1. Receita Bruta (Vendas Confirmadas/Entregues)
    const revenueStats = await this.db.order.aggregate({
      _sum: { total: true, discount: true, delivery_fee: true },
      where: { created_at: { gte: startDate, lte: endDate }, status: { notIn: ['CANCELED'] }, is_proforma: false }
    });

    const grossRevenue = Number(revenueStats._sum.total || 0);
    const totalDiscounts = Number(revenueStats._sum.discount || 0);
    const totalDeliveryFees = Number(revenueStats._sum.delivery_fee || 0);

    // 2. Custos dos Produtos Vendidos (CMV)
    // Busca todos os itens vendidos no período com os dados do produto (para pegar o cost_price)
    const itemsSold = await this.db.orderItem.findMany({
      where: { order: { created_at: { gte: startDate, lte: endDate }, status: { notIn: ['CANCELED'] }, is_proforma: false } },
      include: { product: { select: { cost_price: true } } }
    });

    let totalCogs = 0; // Cost of Goods Sold
    itemsSold.forEach(item => {
      const cost = Number(item.product.cost_price || 0);
      totalCogs += cost * item.quantity;
    });

    // 3. Despesas com Taxas de Pagamento (Cartão, Pix, Boleto)
    const paymentStats = await this.db.payment.aggregate({
      _sum: { fee: true },
      where: { created_at: { gte: startDate, lte: endDate }, status: 'PAID' }
    });
    const gatewayFees = Number(paymentStats._sum.fee || 0);

    // 4. Cálculo de Lucro Líquido
    const netRevenue = grossRevenue - totalDeliveryFees; // Frete repassado não é receita real
    const grossMargin = netRevenue - totalCogs;
    const netProfit = grossMargin - gatewayFees;
    
    const marginPercentage = netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(2) : 0;

    return {
      period: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
      revenue: {
        gross_revenue: grossRevenue.toFixed(2),
        discounts_given: totalDiscounts.toFixed(2),
        delivery_fees_collected: totalDeliveryFees.toFixed(2),
        net_revenue: netRevenue.toFixed(2),
      },
      costs: {
        cogs_product_costs: totalCogs.toFixed(2),
        gateway_fees: gatewayFees.toFixed(2),
      },
      profit: {
        net_profit: netProfit.toFixed(2),
        profit_margin_percentage: `${marginPercentage}%`
      }
    };
  }

  async getAccountsReceivable() {
    // Boletos e Fiado/Crédito Loja que estão pendentes ou vencidos
    const receivables = await this.db.payment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        method: { in: ['BOLETO', 'STORE_CREDIT'] }
      },
      include: { client: { select: { name: true, company_name: true, phone: true } } },
      orderBy: { boleto_due_date: 'asc' }
    });

    let totalPending = 0;
    let totalOverdue = 0;
    const now = new Date();

    const data = receivables.map(r => {
      const isOverdue = r.boleto_due_date ? r.boleto_due_date < now : false;
      const amount = Number(r.amount);
      
      if (isOverdue) totalOverdue += amount;
      else totalPending += amount;

      return {
        payment_id: r.id,
        client: r.client?.name || r.client?.company_name || 'Desconhecido',
        phone: r.client?.phone,
        method: r.method,
        amount: amount.toFixed(2),
        due_date: r.boleto_due_date?.toISOString().split('T')[0] || 'N/A',
        status: isOverdue ? 'OVERDUE' : 'PENDING'
      };
    });

    return {
      summary: {
        total_pending: totalPending.toFixed(2),
        total_overdue: totalOverdue.toFixed(2),
        total_receivable: (totalPending + totalOverdue).toFixed(2),
      },
      data
    };
  }

  async getCashFlow(startDate: Date, endDate: Date) {
    // Fluxo de caixa do PDV físico (Gaveta)
    const movements = await this.db.cashMovement.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: { created_at: { gte: startDate, lte: endDate } }
    });

    const flow = {
      inflows_sales: 0,
      inflows_supply: 0,
      outflows_withdrawals: 0,
      outflows_refunds: 0,
    };

    movements.forEach(m => {
      const val = Number(m._sum.amount || 0);
      if (m.type === 'SALE' || m.type === 'MANUAL_IN') flow.inflows_sales += val;
      if (m.type === 'SUPPLY') flow.inflows_supply += val;
      if (m.type === 'WITHDRAWAL' || m.type === 'MANUAL_OUT') flow.outflows_withdrawals += val;
      if (m.type === 'REFUND') flow.outflows_refunds += val;
    });

    const netCashFlow = (flow.inflows_sales + flow.inflows_supply) - (flow.outflows_withdrawals + flow.outflows_refunds);

    return {
      period: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
      ...flow,
      net_cash_flow: netCashFlow.toFixed(2)
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  parseDates(query: { start_date?: string, end_date?: string }) {
    const end = query.end_date ? new Date(`${query.end_date}T23:59:59.999Z`) : new Date();
    const start = query.start_date ? new Date(`${query.start_date}T00:00:00.000Z`) : new Date();
    if (!query.start_date) start.setDate(end.getDate() - 30); // Padrão: últimos 30 dias
    return { startDate: start, endDate: end };
  }

  generateCSV(data: any[]): string {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(',')).join('\n');
    return `${headers}\n${rows}`;
  }
}