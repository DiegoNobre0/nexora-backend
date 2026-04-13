import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/errors/AppError';
import { DeliveryService } from '../delivery/delivery.service';
import type { 
  CreateOrderInput, UpdateOrderStatusInput, CancelOrderInput, 
  AssignDeliveryInput, ListOrdersInput, CalculateTotalInput, OrderItemInput 
} from './orders.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Orders
//
// Validação de estoque, cálculo seguro de preços, motor de frete
// e máquina de estados para controle do fluxo do pedido.
// ─────────────────────────────────────────────────────────────

export class OrdersService {
  private deliveryService: DeliveryService;

  constructor(private readonly db: BusinessClient) {
    // Instancia o serviço de frete injetando o mesmo contexto de banco
    this.deliveryService = new DeliveryService(db);
  }

  // ─── 1. Motor de Preços e Frete ────────────────────────────

  async calculateOrderTotal(input: CalculateTotalInput) {
    const { items, address_id, type } = input;
    
    let subtotal = 0;
    const processedItems = [];

    // 1. Busca os preços reais no banco e valida disponibilidade
    for (const item of items) {
      const product = await this.db.product.findUnique({ where: { id: item.product_id } });
      if (!product) throw new NotFoundError(`Produto ID ${item.product_id}`);
      if (!product.is_active) throw new ValidationError(`Produto "${product.name}" está indisponível.`);
      
      const lineTotal = Number(product.price) * item.quantity;
      subtotal += lineTotal;

      processedItems.push({
        product_id: product.id,
        name:       product.name,
        quantity:   item.quantity,
        unit_price: Number(product.price),
        total:      lineTotal,
      });
    }

    // 2. Cálculo do Frete
    let delivery_fee = 0;
    if (type === 'DELIVERY') {
      if (!address_id) throw new ValidationError('Endereço é obrigatório para pedidos de entrega.');
      const address = await this.db.address.findUnique({ where: { id: address_id } });
      if (!address) throw new NotFoundError('Endereço');

      // Chama o motor inteligente de frete que criamos no módulo Delivery
      const feeResult = await this.deliveryService.calculateFee({
        order_amount: subtotal,
        zip_code: address.zip_code,
        district: address.district,
      });
      delivery_fee = feeResult.delivery_fee;
    }

    const total = subtotal + delivery_fee;

    return {
      subtotal,
      delivery_fee,
      total,
      items: processedItems,
    };
  }

  // ─── 2. Criação (Pedidos e Orçamentos) ─────────────────────

  async createOrder(input: CreateOrderInput) {
    // Executa a simulação financeira primeiro (Segurança)
    const calculation = await this.calculateOrderTotal({
      items: input.items,
      address_id: input.address_id,
      type: input.type,
    });

    const finalTotal = calculation.total - input.discount;
    if (finalTotal < 0) throw new ValidationError('Desconto não pode ser maior que o total do pedido.');

    // Inicia a Transação: Cria Pedido + Cria Itens + Baixa Estoque
    return this.db.$transaction(async (prisma) => {
      // Validação de Estoque em tempo real (evita race condition)
      if (!input.is_proforma) {
        for (const item of input.items) {
          const product = await prisma.product.findUnique({ where: { id: item.product_id } });
          if (product!.stock_qty < item.quantity) {
            throw new ValidationError(`Estoque insuficiente para "${product!.name}". Disponível: ${product!.stock_qty}`);
          }
          // Baixa o estoque
          await prisma.product.update({
            where: { id: item.product_id },
            data: { stock_qty: { decrement: item.quantity } },
          });
        }
      }

      // Cria o Pedido principal
      const order = await prisma.order.create({
        data: {
          client_id:    input.client_id,
          employee_id:  input.employee_id,
          address_id:   input.address_id,
          channel:      input.channel,
          type:         input.type,
          status:       'PENDING',
          is_proforma:  input.is_proforma,
          subtotal:     calculation.subtotal,
          delivery_fee: calculation.delivery_fee,
          discount:     input.discount,
          total:        finalTotal,
          notes:        input.notes,
          items: {
            create: calculation.items.map(i => ({
              product_id: i.product_id,
              quantity:   i.quantity,
              unit_price: i.unit_price,
              total:      i.total,
              notes:      input.items.find(reqItem => reqItem.product_id === i.product_id)?.notes,
            })),
          },
        },
        include: { items: true, client: true },
      });

      return order;
    });
  }

  async createProforma(clientId: string, items: OrderItemInput[]) {
    return this.createOrder({
      client_id: clientId,
      items,
      is_proforma: true,
      channel: 'WHATSAPP',
      type: 'DELIVERY',
      discount: 0, // <-- Adicionado aqui
    });
  }

  async convertProformaToOrder(orderId: string) {
    const order = await this.getOrderById(orderId);
    
    if (!order.is_proforma) throw new ValidationError('Este pedido não é um orçamento.');
    if (order.status === 'CANCELED') throw new ValidationError('Orçamento cancelado não pode ser convertido.');

    return this.db.$transaction(async (prisma) => {
      // Baixa o estoque agora que virou pedido real
      for (const item of order.items) {
        const product = await prisma.product.findUnique({ where: { id: item.product_id } });
        if (product!.stock_qty < item.quantity) {
          throw new ValidationError(`Estoque insuficiente para converter orçamento. Falta: "${product!.name}".`);
        }
        await prisma.product.update({
          where: { id: item.product_id },
          data: { stock_qty: { decrement: item.quantity } },
        });
      }

      return prisma.order.update({
        where: { id: orderId },
        data: { is_proforma: false, status: 'CONFIRMED' },
        include: { items: true },
      });
    });
  }

  // ─── 3. Máquina de Estados e Gestão ────────────────────────

  async updateOrderStatus(orderId: string, status: UpdateOrderStatusInput['status']) {
    const order = await this.getOrderById(orderId);
    if (order.status === 'CANCELED') throw new ValidationError('Pedido cancelado não pode ter status alterado.');
    if (order.status === 'DELIVERED') throw new ValidationError('Pedido já entregue.');

    // Regra: Se marcou como entregue, salva a data exata
    const deliveredAt = status === 'DELIVERED' ? new Date() : undefined;

    return this.db.order.update({
      where: { id: orderId },
      data: { status, delivered_at: deliveredAt },
    });
  }

  async cancelOrder(orderId: string, reason: string) {
    const order = await this.getOrderById(orderId);
    if (order.status === 'CANCELED') throw new ValidationError('O pedido já está cancelado.');
    if (order.status === 'DELIVERED') throw new ValidationError('Pedido já entregue não pode ser cancelado (use Estorno).');

    return this.db.$transaction(async (prisma) => {
      // Se não era orçamento, devolve os itens para o estoque
      if (!order.is_proforma) {
        for (const item of order.items) {
          await prisma.product.update({
            where: { id: item.product_id },
            data: { stock_qty: { increment: item.quantity } },
          });
        }
      }

      return prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'CANCELED', 
          canceled_at: new Date(), 
          cancel_reason: reason 
        },
      });
    });
  }

  async assignDelivery(orderId: string, employeeId: string) {
    await this.getOrderById(orderId);
    
    // Verifica se é entregador válido
    const employee = await this.db.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !employee.is_active) throw new NotFoundError('Entregador ativo');

    return this.db.order.update({
      where: { id: orderId },
      data: { employee_id: employeeId, status: 'IN_DELIVERY' },
      include: { employee: true },
    });
  }

  async estimateDeliveryTime(orderId: string) {
    const order = await this.getOrderById(orderId);
    if (order.status === 'DELIVERED' || order.status === 'CANCELED') {
      return { message: 'Pedido finalizado ou cancelado.', minutes: 0 };
    }

    // Lógica simples: Conta quantos pedidos "PREPARING" estão na frente
    const queueBefore = await this.db.order.count({
      where: {
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] },
        created_at: { lt: order.created_at }
      }
    });

    const estimatedMinutes = 20 + (queueBefore * 5); // 20m base + 5m por pedido na fila
    
    const estimatedDate = new Date();
    estimatedDate.setMinutes(estimatedDate.getMinutes() + estimatedMinutes);

    return {
      order_id: order.id,
      status: order.status,
      queue_position: queueBefore + 1,
      estimated_minutes: estimatedMinutes,
      estimated_time: estimatedDate.toISOString(),
    };
  }

  // ─── 4. Listagens e Buscas ─────────────────────────────────

  async getOrderById(id: string) {
    const order = await this.db.order.findUnique({
      where: { id },
      include: {
        client: true,
        address: true,
        employee: true,
        items: { include: { product: { select: { name: true, unit: true } } } },
        payments: true,
      },
    });
    if (!order) throw new NotFoundError('Pedido');
    return order;
  }

  async listOrders(input: ListOrdersInput) {
    const { status, channel, client_id, date, page, limit } = input;
    const skip = (page - 1) * limit;

    let dateFilter = {};
    if (date) {
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate   = new Date(`${date}T23:59:59.999Z`);
      dateFilter = { created_at: { gte: startDate, lte: endDate } };
    }

    const where = {
      ...(status    && { status }),
      ...(channel   && { channel }),
      ...(client_id && { client_id }),
      ...dateFilter,
    };

    const [orders, total] = await Promise.all([
      this.db.order.findMany({
        where, skip, take: limit,
        orderBy: { created_at: 'desc' },
        include: { client: { select: { name: true, phone: true } } },
      }),
      this.db.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  // ─── 5. Dashboards e Operação Interna ──────────────────────

  async getQueueStatus() {
    // Traz a quantidade de pedidos em cada status para o painel da cozinha/expedição
    const stats = await this.db.order.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { is_proforma: false, status: { notIn: ['DELIVERED', 'CANCELED'] } },
    });

    const queue = {
      PENDING: 0, CONFIRMED: 0, PREPARING: 0, READY: 0, IN_DELIVERY: 0
    };
    stats.forEach(s => { queue[s.status as keyof typeof queue] = s._count.status; });
    
    return queue;
  }

 async getDashboardSummary(dateStr?: string) {
    // Se não passar data, pega o resumo de "Hoje"
    const today = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Tipamos como 'any' para evitar que o Prisma reclame da inferência de Enums
    const whereDaily: any = {
      is_proforma: false,
      status: { not: 'CANCELED' }, // Usamos 'not' em vez de 'notIn' para simplificar
      created_at: { gte: today, lt: tomorrow }
    };

    const [totalOrders, aggregations] = await Promise.all([
      this.db.order.count({ where: whereDaily }),
      this.db.order.aggregate({
        where: whereDaily,
        _sum: { total: true },
        _avg: { total: true },
      })
    ]);

    return {
      date: today.toISOString().split('T')[0],
      total_orders: totalOrders,
      // Adicionado o ?. para evitar erro caso não tenha vendas no dia
      total_revenue: Number(aggregations._sum?.total || 0).toFixed(2),
      average_ticket: Number(aggregations._avg?.total || 0).toFixed(2),
    };
  }

  async generateDailyReport(dateStr: string) {
    const summary = await this.getDashboardSummary(dateStr);
    
    const startDate = new Date(`${dateStr}T00:00:00.000Z`);
    const endDate   = new Date(`${dateStr}T23:59:59.999Z`);

    // Busca os pedidos do dia para listagem detalhada no relatório
    const orders = await this.db.order.findMany({
      where: { created_at: { gte: startDate, lte: endDate }, is_proforma: false },
      select: { id: true, total: true, status: true, channel: true },
      orderBy: { created_at: 'asc' }
    });

    return { summary, orders };
  }
}