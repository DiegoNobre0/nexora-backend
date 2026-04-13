import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/errors/AppError';
import type { 
  OpenRegisterInput, CloseRegisterInput, MovementInput, ManualEntryInput 
} from './cash-register.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Cash Register
//
// Controle de abertura, fechamento, sangrias, suprimentos
// e conferência de valores físicos (Quebra de caixa).
// ─────────────────────────────────────────────────────────────

export class CashRegisterService {
  constructor(private readonly db: BusinessClient) {}

  // ─── 1. Abertura e Fechamento ──────────────────────────────

  async getOpenRegister(employeeId: string) {
    const register = await this.db.cashRegister.findFirst({
      where: { employee_id: employeeId, status: 'OPEN' },
      include: { employee: { select: { name: true } } }
    });
    return register; // Pode retornar null, o controller lida com isso (não é erro, apenas significa caixa fechado)
  }

  async openCashRegister(input: OpenRegisterInput) {
    // 1. Verifica se o funcionário já tem um caixa aberto
    const existing = await this.getOpenRegister(input.employee_id);
    if (existing) {
      throw new ConflictError(`O operador ${existing.employee.name} já possui um caixa aberto.`);
    }

    // 2. Cria o caixa aberto e registra a movimentação inicial
    return this.db.$transaction(async (prisma) => {
      const register = await prisma.cashRegister.create({
        data: {
          employee_id:     input.employee_id,
          status:          'OPEN',
          opening_balance: input.opening_balance,
          notes:           input.notes,
        }
      });

      // Se começou com troco, registra isso no fluxo de movimentações
      if (input.opening_balance > 0) {
        await prisma.cashMovement.create({
          data: {
            cash_register_id: register.id,
            type:             'SUPPLY', // Suprimento inicial (Troco)
            amount:           input.opening_balance,
            description:      'Abertura de Caixa (Troco Inicial)',
          }
        });
      }

      return register;
    });
  }

  async closeCashRegister(registerId: string, input: CloseRegisterInput) {
    const register = await this.getRegisterById(registerId);
    if (register.status === 'CLOSED') throw new ValidationError('Este caixa já está fechado.');

    // 1. Pega o resumo para saber o valor exato que o sistema espera ter em dinheiro físico
    const summary = await this.getCashRegisterSummary(registerId);
    
    // O saldo do sistema é o que entrou em dinheiro físico (Vendas em dinheiro + Troco inicial + Entradas manuais) 
    // MENOS o que saiu em dinheiro (Sangrias + Saídas Manuais + Estornos em dinheiro)
    const systemBalance = summary.expected_physical_cash;
    
    // 2. Calcula a diferença (Positivo = Sobra, Negativo = Quebra/Falta)
    const difference = input.counted_balance - systemBalance;

    // Se houver diferença, a justificativa é obrigatória
    if (difference !== 0 && !input.diff_reason) {
      throw new ValidationError(`Diferença de caixa detectada (R$ ${difference.toFixed(2)}). É obrigatório informar o motivo (diff_reason).`);
    }

    // 3. Fecha o caixa e salva os totais
    return this.db.cashRegister.update({
      where: { id: registerId },
      data: {
        status:          'CLOSED',
        closed_at:       new Date(),
        system_balance:  systemBalance,
        closing_balance: input.counted_balance,
        difference:      difference,
        diff_reason:     input.diff_reason,
      }
    });
  }

  // ─── 2. Movimentações Físicas ──────────────────────────────

  async registerWithdrawal(registerId: string, input: MovementInput) {
    await this.ensureRegisterIsOpen(registerId);
    
    // Sangria: Retirada de dinheiro do caixa físico
    return this.db.cashMovement.create({
      data: {
        cash_register_id: registerId,
        type:             'WITHDRAWAL',
        amount:           input.amount,
        description:      input.description,
      }
    });
  }

  async registerSupply(registerId: string, input: MovementInput) {
    await this.ensureRegisterIsOpen(registerId);
    
    // Suprimento: Adição de dinheiro ao caixa físico (ex: mais troco)
    return this.db.cashMovement.create({
      data: {
        cash_register_id: registerId,
        type:             'SUPPLY',
        amount:           input.amount,
        description:      input.description,
      }
    });
  }

  async registerManualEntry(registerId: string, input: ManualEntryInput) {
    await this.ensureRegisterIsOpen(registerId);
    
    // Entrada ou Saída manual avulsa
    return this.db.cashMovement.create({
      data: {
        cash_register_id: registerId,
        type:             input.type,
        amount:           input.amount,
        description:      input.description,
      }
    });
  }

  // ─── 3. Relatórios e Conferências ──────────────────────────

  async listMovements(registerId: string) {
    await this.getRegisterById(registerId);
    return this.db.cashMovement.findMany({
      where: { cash_register_id: registerId },
      orderBy: { created_at: 'asc' },
      include: { payment: { select: { method: true, net_amount: true } } } // Inclui dados da venda se houver
    });
  }

  async getCashRegisterSummary(registerId: string) {
    const register = await this.getRegisterById(registerId);
    const movements = await this.listMovements(registerId);

    // Variáveis de acumulação
    let totalSalesCash = 0;
    let totalSalesOther = 0; // Pix, Cartões, etc.
    let totalSupply = 0;     // Suprimentos e Entradas
    let totalWithdrawal = 0; // Sangrias e Saídas
    let totalRefunds = 0;    // Estornos
    
    // Breakdown por métodos de pagamento para conferência de maquininha
    const paymentMethodsSummary: Record<string, number> = {};

    for (const mov of movements) {
      const val = Number(mov.amount);

      if (mov.type === 'SALE') {
        const method = mov.payment?.method || 'UNKNOWN';
        paymentMethodsSummary[method] = (paymentMethodsSummary[method] || 0) + val;
        
        if (method === 'CASH') totalSalesCash += val;
        else totalSalesOther += val;
      } 
      else if (mov.type === 'REFUND') {
        totalRefunds += val;
      }
      else if (mov.type === 'SUPPLY' || mov.type === 'MANUAL_IN') {
        totalSupply += val;
      }
      else if (mov.type === 'WITHDRAWAL' || mov.type === 'MANUAL_OUT') {
        totalWithdrawal += val;
      }
    }

    // O dinheiro físico esperado na gaveta
    const expectedPhysicalCash = totalSalesCash + totalSupply - totalWithdrawal - totalRefunds;

    return {
      register_id: register.id,
      status:      register.status,
      opened_at:   register.opened_at,
      closed_at:   register.closed_at,
      metrics: {
        opening_balance: Number(register.opening_balance),
        total_sales_cash: totalSalesCash,
        total_sales_other: totalSalesOther,
        total_supply_in: totalSupply,
        total_withdrawal_out: totalWithdrawal,
        total_refunds: totalRefunds,
      },
      payment_methods_breakdown: paymentMethodsSummary,
      expected_physical_cash: expectedPhysicalCash, // O número mágico que o operador precisa bater no fim do dia
    };
  }

  async generateClosingReport(registerId: string) {
    const summary = await this.getCashRegisterSummary(registerId);
    const register = await this.getRegisterById(registerId);
    
    if (register.status !== 'CLOSED') {
      throw new ValidationError('Relatório de fechamento só fica disponível após o fechamento do caixa.');
    }

    return {
      report_type: "FECHAMENTO DE CAIXA",
      operator: register.employee.name,
      ...summary,
      closing_metrics: {
        system_expected: Number(register.system_balance),
        operator_counted: Number(register.closing_balance),
        difference: Number(register.difference),
        reason: register.diff_reason || 'Nenhuma diferença relatada.',
      }
    };
  }

  // ─── Métodos Auxiliares ────────────────────────────────────

  private async getRegisterById(id: string) {
    const register = await this.db.cashRegister.findUnique({
      where: { id },
      include: { employee: true }
    });
    if (!register) throw new NotFoundError('Caixa');
    return register;
  }

  private async ensureRegisterIsOpen(id: string) {
    const register = await this.getRegisterById(id);
    if (register.status !== 'OPEN') {
      throw new ValidationError(`Operação não permitida. O caixa atual está ${register.status}.`);
    }
    return register;
  }
}