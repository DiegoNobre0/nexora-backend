import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/errors/AppError';
import type { CreateClientInput, UpdateClientInput, ListClientsInput, AddressInput } from './clients.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Clients
//
// Core de gestão de clientes, unificação de cadastros (merge),
// validação de documentos Brasileiros e gestão de múltiplos endereços.
// ─────────────────────────────────────────────────────────────

export class ClientsService {
  constructor(private readonly db: BusinessClient) { }

  // ─── Buscas Únicas ─────────────────────────────────────────

  async getClientById(id: string) {
    const client = await this.db.client.findUnique({
      where: { id },
      include: { addresses: true },
    });
    if (!client) throw new NotFoundError('Cliente');
    return client;
  }

  async getClientByPhone(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const client = await this.db.client.findUnique({ where: { phone: cleanPhone }, include: { addresses: true } });
    if (!client) throw new NotFoundError('Cliente com este telefone');
    return client;
  }

  async getClientByDocument(document: string) {
    const cleanDoc = document.replace(/\D/g, '');
    const client = await this.db.client.findFirst({
      where: {
        OR: [{ cpf: cleanDoc }, { cnpj: cleanDoc }],
      },
      include: { addresses: true },
    });
    if (!client) throw new NotFoundError('Cliente com este documento');
    return client;
  }

  // ─── Listagem com Filtros ──────────────────────────────────

  async list(input: ListClientsInput) {
    const { type, is_blocked, search, page, limit } = input;
    const skip = (page - 1) * limit;

    const where = {
      ...(type && { type }),
      ...(is_blocked !== undefined && { is_blocked }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { company_name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { cpf: { contains: search } },
          { cnpj: { contains: search } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      this.db.client.findMany({
        where, skip, take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.db.client.count({ where }),
    ]);

    return {
      data: clients,
      meta: {
        total, page, limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Criação e Atualização (CRUD base) ─────────────────────

  async createClient(input: CreateClientInput) {
    const cleanPhone = input.phone.replace(/\D/g, '');
    await this.ensurePhoneIsAvailable(cleanPhone);

    if (input.type === 'PF' && input.cpf) {
      if (!this.isValidCPF(input.cpf)) throw new ValidationError('CPF inválido.');
      input.cpf = input.cpf.replace(/\D/g, '');
    }

    if (input.type === 'PJ' && input.cnpj) {
      if (!this.isValidCNPJ(input.cnpj)) throw new ValidationError('CNPJ inválido.');
      input.cnpj = input.cnpj.replace(/\D/g, '');
    }

    // Prisma exige que o campo "name" seja preenchido sempre. 
    // Se for PJ, usamos o company_name como name principal.
    const prismaName = input.type === 'PF' ? input.name : input.company_name;

    return this.db.client.create({
      data: {
        ...input,
        name: prismaName, // Resolvido o erro do Prisma
        phone: cleanPhone
      }
    });
  }

  async updateClient(id: string, input: UpdateClientInput) {
    await this.getClientById(id);

    let cleanPhone = undefined;
    if (input.phone) {
      cleanPhone = input.phone.replace(/\D/g, '');
      await this.ensurePhoneIsAvailable(cleanPhone, id);
    }

    if (input.type === 'PF' && input.cpf) {
      if (!this.isValidCPF(input.cpf)) throw new ValidationError('CPF inválido.');
      input.cpf = input.cpf.replace(/\D/g, '');
    }
    if (input.type === 'PJ' && input.cnpj) {
      if (!this.isValidCNPJ(input.cnpj)) throw new ValidationError('CNPJ inválido.');
      input.cnpj = input.cnpj.replace(/\D/g, '');
    }

    // Se estiver atualizando o nome/razão social, mapeia corretamente para o Prisma
    let prismaName = undefined;
    if (input.type === 'PF' && input.name) prismaName = input.name;
    if (input.type === 'PJ' && input.company_name) prismaName = input.company_name;

    return this.db.client.update({
      where: { id },
      data: {
        ...input,
        ...(cleanPhone && { phone: cleanPhone }),
        ...(prismaName && { name: prismaName })
      },
    });
  }

  // ─── UPSERT (Usado principalmente pelo Bot de WhatsApp) ────

  async upsertClient(phone: string, data: Partial<CreateClientInput>) {
    const cleanPhone = phone.replace(/\D/g, '');
    
    const existing = await this.db.client.findUnique({ where: { phone: cleanPhone } });
    
    if (existing) {
      return this.db.client.update({
        where: { id: existing.id },
        data: data as any, // Cast necessário para o TypeScript aceitar a União
      });
    }

    // Contornamos o erro do TS forçando a leitura como any apenas aqui
    const safeData = data as any;
    const defaultName = safeData.name || safeData.company_name || 'Cliente WhatsApp';
    
    return this.db.client.create({
      data: {
        phone: cleanPhone,
        type: data.type || 'PF',
        name: defaultName,
        ...safeData,
      }
    });
  }

  // ─── Bloqueio / Desbloqueio ────────────────────────────────

  async blockClient(id: string, reason: string) {
    await this.getClientById(id);
    return this.db.client.update({
      where: { id },
      data: { is_blocked: true, block_reason: reason },
    });
  }

  async unblockClient(id: string) {
    await this.getClientById(id);
    return this.db.client.update({
      where: { id },
      data: { is_blocked: false, block_reason: null },
    });
  }

  // ─── Unificação de Cadastros (Merge) ───────────────────────

  // Útil quando o cliente troca de número de WhatsApp mas já tinha histórico
  async mergeClients(primaryId: string, secondaryId: string) {
    if (primaryId === secondaryId) throw new ValidationError('IDs devem ser diferentes.');

    const [primary, secondary] = await Promise.all([
      this.getClientById(primaryId),
      this.getClientById(secondaryId),
    ]);

    // Transfere todas as relações do secundário para o primário numa transação
    await this.db.$transaction([
      this.db.order.updateMany({ where: { client_id: secondaryId }, data: { client_id: primaryId } }),
      this.db.payment.updateMany({ where: { client_id: secondaryId }, data: { client_id: primaryId } }),
      this.db.address.updateMany({ where: { client_id: secondaryId }, data: { client_id: primaryId, is_default: false } }),
      this.db.lead.updateMany({ where: { client_id: secondaryId }, data: { client_id: primaryId } }),
      // Soma os saldos/pontos
      this.db.client.update({
        where: { id: primaryId },
        data: {
          credit_balance: { increment: secondary.credit_balance },
          loyalty_points: { increment: secondary.loyalty_points },
        }
      }),
      // Apaga o cadastro secundário
      this.db.client.delete({ where: { id: secondaryId } }),
    ]);

    return { message: 'Cadastros unificados com sucesso.' };
  }

  // ─── Gestão de Endereços ───────────────────────────────────

  async addAddress(clientId: string, input: AddressInput) {
    await this.getClientById(clientId);

    if (input.is_default) {
      // Se este for o padrão, remove a flag dos outros
      await this.db.address.updateMany({
        where: { client_id: clientId },
        data: { is_default: false },
      });
    }

    return this.db.address.create({
      data: { ...input, client_id: clientId },
    });
  }

  async updateAddress(addressId: string, input: Partial<AddressInput>) {
    const address = await this.db.address.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundError('Endereço');

    if (input.is_default) {
      await this.db.address.updateMany({
        where: { client_id: address.client_id, NOT: { id: addressId } },
        data: { is_default: false },
      });
    }

    return this.db.address.update({ where: { id: addressId }, data: input });
  }

  async deleteAddress(addressId: string) {
    const address = await this.db.address.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundError('Endereço');
    await this.db.address.delete({ where: { id: addressId } });
    return { message: 'Endereço removido.' };
  }

  // ─── Exportação ────────────────────────────────────────────

  async exportCSV(): Promise<string> {
    const clients = await this.db.client.findMany({ orderBy: { created_at: 'desc' } });

    let csv = 'ID,TIPO,NOME/RAZAO_SOCIAL,DOCUMENTO,TELEFONE,EMAIL,CRIADO_EM\n';

    clients.forEach(c => {
      const nome = c.type === 'PF' ? c.name : c.company_name;
      const doc = c.type === 'PF' ? c.cpf : c.cnpj;
      const date = c.created_at.toISOString().split('T')[0];

      // Escapa aspas e vírgulas do nome
      const safeName = `"${(nome || '').replace(/"/g, '""')}"`;

      csv += `${c.id},${c.type},${safeName},${doc || ''},${c.phone},${c.email || ''},${date}\n`;
    });

    return csv;
  }

  // ─── Métodos Privados & Validações ─────────────────────────

  private async ensurePhoneIsAvailable(phone: string, excludeId?: string) {
    const existing = await this.db.client.findUnique({ where: { phone } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictError('Já existe um cliente cadastrado com este telefone.');
    }
  }

  // Validador real de CPF (Algoritmo Oficial)
  private isValidCPF(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0, rest;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cpf.substring(10, 11))) return false;
    return true;
  }

  // Validador real de CNPJ (Algoritmo Oficial)
  private isValidCNPJ(cnpj: string): boolean {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    let digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(0))) return false;
    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(1))) return false;
    return true;
  }
}