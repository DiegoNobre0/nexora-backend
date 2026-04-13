import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError } from '../../../shared/errors/AppError';
import type { CreateTaxInput, UpdateTaxInput, ListTaxesInput, CalculateFeeInput } from './taxes.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Taxes
//
// Gerencia as taxas por forma de pagamento e calcula
// o custo real de cada transação para o comerciante.
// ─────────────────────────────────────────────────────────────

export class TaxesService {
  constructor(private readonly db: BusinessClient) {}

  // ─── Listar com filtros e paginação ───────────────────────
  async list(input: ListTaxesInput) {
    const { method, is_active, page, limit } = input;
    const skip = (page - 1) * limit;

    const where = {
      ...(method    && { method }),
      ...(is_active !== undefined && { is_active }),
    };

    const [taxes, total] = await Promise.all([
      this.db.tax.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { name: 'asc' },
      }),
      this.db.tax.count({ where }),
    ]);

    return {
      data: taxes,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next:    page * limit < total,
        has_prev:    page > 1,
      },
    };
  }

  // ─── Buscar por ID ─────────────────────────────────────────
  async findById(id: string) {
    const tax = await this.db.tax.findUnique({ where: { id } });

    if (!tax) throw new NotFoundError('Taxa');

    return tax;
  }

  // ─── Criar ────────────────────────────────────────────────
  async create(input: CreateTaxInput) {
    return this.db.tax.create({ data: input });
  }

  // ─── Atualizar ────────────────────────────────────────────
  async update(id: string, input: UpdateTaxInput) {
    await this.findById(id);
    return this.db.tax.update({ where: { id }, data: input });
  }

  // ─── Deletar ──────────────────────────────────────────────
  async delete(id: string) {
    const tax = await this.findById(id);
    await this.db.tax.delete({ where: { id } });
    return { message: `Taxa "${tax.name}" deletada com sucesso.` };
  }

  // ─── Calcular taxa — ponto de entrada unificado ────────────
  // O controller chama este método e ele roteia para o cálculo correto
  async calculateFee(input: CalculateFeeInput) {
    const { method, amount, brand, installments } = input;

    if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
      return this.calculateCardFee(amount, brand, installments);
    }

    if (method === 'PIX') {
      return this.calculatePixFee(amount);
    }

    if (method === 'BOLETO') {
      return this.calculateBoletoFee(amount);
    }

    if (method === 'VR' || method === 'VA') {
      return this.calculateVrVaFee(amount, method, brand);
    }

    // Dinheiro e crédito loja não têm taxa
    return this.buildFeeResult({ method, amount, rate: 0, fixedAmount: 0, taxName: 'Sem taxa' });
  }

  // ─── Calcular taxa de cartão ───────────────────────────────
  // Busca a taxa correta considerando bandeira e número de parcelas
  async calculateCardFee(amount: number, brand?: string, installments = 1) {
    const taxes = await this.db.tax.findMany({
      where: {
        method:    { in: ['CREDIT_CARD', 'DEBIT_CARD'] },
        is_active: true,
        ...(brand && { brand }),
      },
      orderBy: { installments: 'asc' },
    });

    // Encontra a taxa mais adequada para o número de parcelas informado.
    // Lógica: pega a taxa cujo campo installments seja >= parcelas solicitadas.
    // Ex: taxa cadastrada para "até 6x" cobre compras de 1x a 6x.
    const tax = taxes.find(t => !t.installments || t.installments >= installments)
             ?? taxes[taxes.length - 1]; // fallback para a última taxa cadastrada

    if (!tax) {
      return this.buildFeeResult({ method: 'CREDIT_CARD', amount, rate: 0, fixedAmount: 0, taxName: 'Taxa não configurada' });
    }

    return this.buildFeeResult({
      method:      'CREDIT_CARD',
      amount,
      rate:        Number(tax.rate),
      fixedAmount: Number(tax.fixed_amount),
      taxName:     tax.name,
      installments,
      brand,
    });
  }

  // ─── Calcular taxa de Pix ──────────────────────────────────
  async calculatePixFee(amount: number) {
    const tax = await this.db.tax.findFirst({
      where: { method: 'PIX', is_active: true },
    });

    if (!tax) {
      return this.buildFeeResult({ method: 'PIX', amount, rate: 0, fixedAmount: 0, taxName: 'Taxa não configurada' });
    }

    return this.buildFeeResult({
      method:      'PIX',
      amount,
      rate:        Number(tax.rate),
      fixedAmount: Number(tax.fixed_amount),
      taxName:     tax.name,
    });
  }

  // ─── Calcular taxa de boleto ───────────────────────────────
  async calculateBoletoFee(amount: number) {
    const tax = await this.db.tax.findFirst({
      where: { method: 'BOLETO', is_active: true },
    });

    if (!tax) {
      return this.buildFeeResult({ method: 'BOLETO', amount, rate: 0, fixedAmount: 0, taxName: 'Taxa não configurada' });
    }

    return this.buildFeeResult({
      method:      'BOLETO',
      amount,
      rate:        Number(tax.rate),
      fixedAmount: Number(tax.fixed_amount),
      taxName:     tax.name,
    });
  }

  // ─── Calcular taxa VR/VA ───────────────────────────────────
  async calculateVrVaFee(amount: number, method: 'VR' | 'VA', brand?: string) {
    const tax = await this.db.tax.findFirst({
      where: {
        method,
        is_active: true,
        ...(brand && { brand }),
      },
    });

    if (!tax) {
      return this.buildFeeResult({ method, amount, rate: 0, fixedAmount: 0, taxName: 'Taxa não configurada' });
    }

    return this.buildFeeResult({
      method,
      amount,
      rate:        Number(tax.rate),
      fixedAmount: Number(tax.fixed_amount),
      taxName:     tax.name,
      brand,
    });
  }

  // ─── Métodos privados ──────────────────────────────────────

  /**
   * Monta o resultado padronizado do cálculo de taxa.
   * Centraliza a fórmula: feeAmount = (amount * rate) + fixedAmount
   */
  private buildFeeResult(params: {
    method:       string;
    amount:       number;
    rate:         number;
    fixedAmount:  number;
    taxName:      string;
    installments?: number;
    brand?:        string;
  }) {
    const { method, amount, rate, fixedAmount, taxName, installments, brand } = params;

    // Valor da taxa em reais = percentual sobre o valor + taxa fixa
    const feeAmount  = parseFloat(((amount * rate) + fixedAmount).toFixed(2));

    // Valor líquido que o comerciante recebe após descontar a taxa
    const netAmount  = parseFloat((amount - feeAmount).toFixed(2));

    // Valor por parcela (relevante apenas para cartão parcelado)
    const installmentAmount = installments && installments > 1
      ? parseFloat((amount / installments).toFixed(2))
      : null;

    return {
      method,
      brand:              brand ?? null,
      installments:       installments ?? 1,
      gross_amount:       amount,       // valor bruto (o que o cliente paga)
      fee_amount:         feeAmount,    // custo da taxa para o comerciante
      net_amount:         netAmount,    // valor que entra no caixa
      rate_percentage:    `${(rate * 100).toFixed(2)}%`,
      fixed_amount:       fixedAmount,
      installment_amount: installmentAmount,
      tax_name:           taxName,
    };
  }
}