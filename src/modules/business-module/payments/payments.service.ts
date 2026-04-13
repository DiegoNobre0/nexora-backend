import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';
import { TaxesService } from '../taxes/taxes.service';
import type { 
  CreateIntentInput, GenerateBoletoInput, RefundPaymentInput, WebhookInput 
} from './payments.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Payments
//
// Geração de cobranças, cálculo de taxas cruzadas, estornos
// e recebimento de webhooks de gateways externos.
// ─────────────────────────────────────────────────────────────

export class PaymentsService {
  private taxesService: TaxesService;

  constructor(private readonly db: BusinessClient) {
    this.taxesService = new TaxesService(db);
  }

  // ─── 1. Criação e Intenção de Pagamento ────────────────────

  async createPaymentIntent(input: CreateIntentInput) {
    // 1. Calcula as taxas reais antes de gerar a cobrança
    const feeCalculation = await this.applyTaxToPayment(
      input.amount, 
      input.method, 
      input.brand, 
      input.installments
    );

    // 2. Cria o registro PENDING no banco
    const payment = await this.db.payment.create({
      data: {
        order_id:     input.order_id,
        client_id:    input.client_id,
        method:       input.method,
        amount:       input.amount,
        fee:          feeCalculation.fee_amount,
        net_amount:   feeCalculation.net_amount,
        installments: input.installments,
        status:       'PENDING',
      }
    });

    return payment;
  }

  // ─── 2. Pix ────────────────────────────────────────────────

  async generatePixQRCode(orderId: string, amount: number) {
    const intent = await this.createPaymentIntent({
      order_id: orderId,
      method: 'PIX',
      amount,
      installments: 1, // Pix não tem parcelamento
    });

    // TODO: Aqui entraria a chamada real HTTP para MercadoPago / Asaas
    // const gatewayResponse = await mercadopago.payment.create({...})

    const mockedGatewayResponse = {
      gateway_id: `pix_${new Date().getTime()}`,
      qr_code: "00020101021126580014br.gov.bcb.pix0136mocked-uuid-1234-56785204000053039865405150.005802BR5910NEXORA DEV6009SAO PAULO62070503***6304ABCD",
      qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAA...", // Mock
    };

    // Atualiza o pagamento com os dados gerados pelo Gateway
    const updatedPayment = await this.db.payment.update({
      where: { id: intent.id },
      data: {
        gateway_id: mockedGatewayResponse.gateway_id,
        pix_qr_code: mockedGatewayResponse.qr_code,
        pix_key: "chave-pix-mockada@nexora.com",
      }
    });

    return updatedPayment;
  }

  // ─── 3. Boleto Bancário ────────────────────────────────────

  async generateBoleto(input: GenerateBoletoInput) {
    const dueDate = new Date(`${input.due_date}T23:59:59.999Z`);
    
    if (dueDate < new Date()) {
      throw new ValidationError('A data de vencimento não pode ser no passado.');
    }

    const intent = await this.createPaymentIntent({
      order_id: input.order_id,
      method: 'BOLETO',
      amount: input.amount,
      installments: 1, // Boleto não tem parcelamento
    });

    // TODO: Integração real com emissor de boletos (Asaas/Gerencianet)
    const mockedBoleto = {
      gateway_id: `bol_${new Date().getTime()}`,
      boleto_url: "https://sandbox.asaas.com/b/mocked-boleto-url",
      boleto_barcode: "34191.09008 63571.234567 89123.456789 1 90000000015000",
    };

    return this.db.payment.update({
      where: { id: intent.id },
      data: {
        gateway_id: mockedBoleto.gateway_id,
        boleto_url: mockedBoleto.boleto_url,
        boleto_barcode: mockedBoleto.boleto_barcode,
        boleto_due_date: dueDate,
      }
    });
  }

  async getBoletoStatus(paymentId: string) {
    const payment = await this.getPaymentById(paymentId);
    if (payment.method !== 'BOLETO') throw new ValidationError('Este pagamento não é um boleto.');
    
    // TODO: Consulta status em tempo real no gateway, se necessário
    return {
      id: payment.id,
      status: payment.status,
      due_date: payment.boleto_due_date,
      url: payment.boleto_url,
      barcode: payment.boleto_barcode,
      is_overdue: payment.boleto_due_date ? new Date() > payment.boleto_due_date && payment.status === 'PENDING' : false
    };
  }

  async cancelBoleto(paymentId: string) {
    const payment = await this.getPaymentById(paymentId);
    if (payment.status !== 'PENDING') throw new ValidationError(`Pagamento não pode ser cancelado (Status atual: ${payment.status}).`);

    // TODO: Enviar request HTTP para cancelar no Gateway

    return this.db.payment.update({
      where: { id: paymentId },
      data: { status: 'CANCELED' }
    });
  }

  async reissueBoleto(paymentId: string, newDueDateStr: string) {
    const payment = await this.getPaymentById(paymentId);
    if (payment.status === 'PAID') throw new ValidationError('Boleto já está pago.');

    const newDueDate = new Date(`${newDueDateStr}T23:59:59.999Z`);
    
    // TODO: Enviar request HTTP para alterar vencimento no Gateway

    return this.db.payment.update({
      where: { id: paymentId },
      data: { boleto_due_date: newDueDate, status: 'PENDING' } // Volta pra pendente se estava vencido
    });
  }

  // ─── 4. Webhook (Confirmação Automática) ───────────────────

  async confirmPayment(input: WebhookInput) {
    const payment = await this.db.payment.findFirst({
      where: { gateway_id: input.gateway_id }
    });

    if (!payment) throw new NotFoundError('Pagamento atrelado a este Gateway ID');
    if (payment.status === 'PAID') return { message: 'Pagamento já processado anteriormente. Ignorado.' };

    // Inicia uma transação segura: Atualiza pagamento e avança o pedido
    await this.db.$transaction(async (prisma) => {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { 
          status: input.status, 
          paid_at: input.status === 'PAID' ? (input.paid_at ? new Date(input.paid_at) : new Date()) : null 
        }
      });

      // Se o pagamento for aprovado e estiver ligado a um pedido pendente, avança ele
      if (input.status === 'PAID' && payment.order_id) {
        const order = await prisma.order.findUnique({ where: { id: payment.order_id } });
        
        if (order && order.status === 'PENDING') {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'CONFIRMED' } // Cozinha já pode começar a preparar
          });
        }
      }
    });

    return { message: 'Webhook processado com sucesso.' };
  }

  // ─── 5. Estornos e Recibos ─────────────────────────────────

  async issueRefund(paymentId: string, input: RefundPaymentInput) {
    const payment = await this.getPaymentById(paymentId);
    if (payment.status !== 'PAID') throw new ValidationError('Apenas pagamentos confirmados podem ser estornados.');

    const refundAmount = input.amount || Number(payment.amount);
    if (refundAmount > Number(payment.amount)) {
      throw new ValidationError('Valor do estorno não pode ser maior que o valor pago.');
    }

    // TODO: Chamar API do Gateway para processar estorno real no cartão/pix

    return this.db.payment.update({
      where: { id: paymentId },
      data: {
        status: refundAmount === Number(payment.amount) ? 'REFUNDED' : 'PAID', // Mantém PAID se for parcial
        refunded_at: new Date(),
        refund_reason: input.reason,
      }
    });
  }

  async generateReceipt(paymentId: string) {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: { include: { items: { include: { product: true } } } },
       client: { select: { type: true, name: true, company_name: true, phone: true, cpf: true, cnpj: true } }
      }
    });

    if (!payment) throw new NotFoundError('Pagamento');
    if (payment.status !== 'PAID') throw new ValidationError('O recibo só fica disponível após a confirmação do pagamento.');

    // Prepara um JSON limpo para o Frontend gerar um PDF/Impressão térmica
    return {
      receipt_id:   payment.id.split('-')[0].toUpperCase(),
      paid_at:      payment.paid_at,
      method:       payment.method,
      amount_paid:  Number(payment.amount),
      installments: payment.installments,
      client: payment.client ? {
        name:     payment.client.type === 'PF' ? payment.client.name : payment.client.company_name,
        document: payment.client.type === 'PF' ? payment.client.cpf : payment.client.cnpj,
      } : 'Consumidor Final',
      order_details: payment.order ? {
        order_id: payment.order.id,
        items: payment.order.items.map(i => ({
          product: i.product.name,
          qty: i.quantity,
          total: Number(i.total)
        }))
      } : null,
    };
  }

  // ─── Métodos Auxiliares ────────────────────────────────────

  private async getPaymentById(id: string) {
    const payment = await this.db.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundError('Pagamento');
    return payment;
  }

  private async applyTaxToPayment(amount: number, method: any, brand?: string, installments: number = 1) {
    // Reutiliza a engine de taxas que construímos no TaxesService
    const calculation = await this.taxesService.calculateFee({
      method,
      amount,
      brand,
      installments
    });

    return {
      fee_amount: calculation.fee_amount,
      net_amount: calculation.net_amount
    };
  }
}