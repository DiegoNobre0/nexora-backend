import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ConflictError } from '../../../shared/errors/AppError';
import type { CreateEmployeeInput, UpdateEmployeeInput, ListEmployeesInput } from './employees.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Employees
//
// Gerencia os operadores internos da empresa:
// vendedores, caixas, entregadores, atendentes.
// ─────────────────────────────────────────────────────────────

export class EmployeesService {
  constructor(private readonly db: BusinessClient) {}

  // ─── Listar com filtros e paginação ───────────────────────
  async list(input: ListEmployeesInput) {
    const { name, role, is_active, page, limit } = input;
    const skip = (page - 1) * limit;

    const where = {
      ...(name      && { name: { contains: name, mode: 'insensitive' as const } }),
      ...(role      && { role: { contains: role, mode: 'insensitive' as const } }),
      ...(is_active !== undefined && { is_active }),
    };

    const [employees, total] = await Promise.all([
      this.db.employee.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { name: 'asc' },
      }),
      this.db.employee.count({ where }),
    ]);

    return {
      data: employees,
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
    const employee = await this.db.employee.findUnique({ where: { id } });

    if (!employee) throw new NotFoundError('Funcionário');

    return employee;
  }

  // ─── Criar ────────────────────────────────────────────────
  async create(input: CreateEmployeeInput) {
    // E-mail deve ser único — evita cadastros duplicados
    if (input.email) {
      await this.ensureEmailAvailable(input.email);
    }

    return this.db.employee.create({ data: input });
  }

  // ─── Atualizar ────────────────────────────────────────────
  async update(id: string, input: UpdateEmployeeInput) {
    await this.findById(id);

    // Verifica conflito de e-mail com OUTRO funcionário (exclui ele mesmo)
    if (input.email) {
      await this.ensureEmailAvailable(input.email, id);
    }

    return this.db.employee.update({ where: { id }, data: input });
  }

  // ─── Deletar ──────────────────────────────────────────────
  async delete(id: string) {
    const employee = await this.findById(id);

    // Não permite deletar funcionário com pedidos vinculados
    // para preservar o histórico de vendas e comissões
    const linkedOrders = await this.db.order.count({
      where: { employee_id: id },
    });

    if (linkedOrders > 0) {
      throw new ConflictError(
        `Funcionário "${employee.name}" possui ${linkedOrders} pedido(s) vinculado(s). ` +
        `Desative-o em vez de deletar para preservar o histórico.`
      );
    }

    await this.db.employee.delete({ where: { id } });

    return { message: `Funcionário "${employee.name}" deletado com sucesso.` };
  }

  // ─── Ativar / Desativar ───────────────────────────────────
  async toggle(id: string) {
    const employee = await this.findById(id);

    const updated = await this.db.employee.update({
      where: { id },
      data:  { is_active: !employee.is_active },
    });

    return {
      ...updated,
      message: `Funcionário "${updated.name}" ${updated.is_active ? 'ativado' : 'desativado'} com sucesso.`,
    };
  }

  // ─── Métodos privados ──────────────────────────────────────

  private async ensureEmailAvailable(email: string, excludeId?: string) {
    const existing = await this.db.employee.findFirst({
      where: {
        email,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
    });

    if (existing) throw new ConflictError('Já existe um funcionário com este e-mail.');
  }
}