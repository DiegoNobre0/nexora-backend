import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/errors/AppError';
import type { 
  CreateLeadInput, 
  CaptureDataInput, 
  RegisterFollowUpInput, 
  ListLeadsInput 
} from './leads.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Leads
//
// Captação via bot, motor de scoring automático (Quente/Morno/Frio)
// e conversão segura de Lead para Cliente.
// ─────────────────────────────────────────────────────────────

export class LeadsService {
  constructor(private readonly db: BusinessClient) {}

  // ─── 1. Captação Inicial ───────────────────────────────────

  async createLead(input: CreateLeadInput) {
    const cleanPhone = input.phone.replace(/\D/g, '');

    // Verifica se esse telefone já é um CLIENTE da base
    const existingClient = await this.db.client.findUnique({ where: { phone: cleanPhone } });
    if (existingClient) {
      throw new ConflictError('Este número já pertence a um cliente ativo na base.');
    }

    // Verifica se já existe um LEAD ativo com esse número (evita duplicar no bot)
    const existingLead = await this.db.lead.findFirst({
      where: { phone: cleanPhone, status: { notIn: ['CONVERTED', 'ARCHIVED'] } }
    });
    if (existingLead) return existingLead; // Retorna silenciosamente o lead existente (Idempotência para o bot)

    return this.db.lead.create({
      data: {
        phone: cleanPhone,
        source: input.source,
        status: 'NEW',
        temperature: 'COLD', // Começa frio até sabermos mais
        score: 0,
      }
    });
  }

  // ─── 2. Enriquecimento de Dados & Motor de Scoring ─────────

  async captureLeadData(leadId: string, data: CaptureDataInput) {
    const lead = await this.getLeadById(leadId);

    // Atualiza os dados coletados (ex: Bot perguntou o nome e o interesse)
    await this.db.lead.update({
      where: { id: leadId },
      data: { ...data, last_contact: new Date() },
    });

    // Logo após capturar os dados, roda o motor de pontuação automaticamente
    return this.scoreLead(leadId);
  }

  // Engine Interno: Calcula a pontuação baseada em sinais de intenção
  async scoreLead(leadId: string) {
    const lead = await this.getLeadById(leadId);
    let score = 0;

    // Sinais explícitos (Preenchimento de funil)
    if (lead.name) score += 10;
    if (lead.email) score += 10;
    if (lead.type === 'PJ' || lead.company_name) score += 20; // B2B tem ticket médio maior
    
    // Sinais de intenção (O que o cliente digitou no WhatsApp)
    if (lead.interest) {
      const interestLower = lead.interest.toLowerCase();
      if (interestLower.includes('preço') || interestLower.includes('valor')) score += 30;
      if (interestLower.includes('quantidade') || interestLower.includes('caixa')) score += 25;
      if (interestLower.includes('prazo') || interestLower.includes('entrega')) score += 20;
      if (interestLower.includes('catálogo') || interestLower.includes('informações')) score += 10;
    }

    // Fator de engajamento (Follow-ups respondidos aumentam o score)
    const interactions = await this.db.leadFollowUp.count({
      where: { lead_id: leadId, responded: true }
    });
    score += (interactions * 15); // +15 pontos por cada resposta que ele deu

    // Limita o score máximo a 100
    const finalScore = Math.min(score, 100);
    const temperature = this.classifyLeadTemperature(finalScore);

    return this.db.lead.update({
      where: { id: leadId },
      data: { score: finalScore, temperature },
    });
  }

  private classifyLeadTemperature(score: number): 'HOT' | 'WARM' | 'COLD' {
    if (score >= 70) return 'HOT';
    if (score >= 30) return 'WARM';
    return 'COLD';
  }

  // ─── 3. Gestão do Funil (CRM) ──────────────────────────────

  async getLeadsByStatus(input: ListLeadsInput) {
    const { status, temperature, source, page, limit } = input;
    const skip = (page - 1) * limit;

    const where = {
      ...(status      && { status }),
      ...(temperature && { temperature }),
      ...(source      && { source }),
    };

    const [leads, total] = await Promise.all([
      this.db.lead.findMany({ where, skip, take: limit, orderBy: { updated_at: 'desc' } }),
      this.db.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async updateLeadStatus(leadId: string, status: 'NEW' | 'CONTACTED' | 'NURTURING' | 'CONVERTED' | 'ARCHIVED') {
    await this.getLeadById(leadId);
    return this.db.lead.update({ where: { id: leadId }, data: { status } });
  }

  async assignLead(leadId: string, employeeId: string) {
    await this.getLeadById(leadId);
    // Valida se funcionário existe
    const employee = await this.db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundError('Funcionário');

    return this.db.lead.update({ where: { id: leadId }, data: { assignee_id: employeeId } });
  }

  async archiveLead(leadId: string) {
    return this.updateLeadStatus(leadId, 'ARCHIVED');
  }

  // ─── 4. Conversão (O objetivo final) ───────────────────────

  async convertLeadToClient(leadId: string) {
    const lead = await this.getLeadById(leadId);

    if (lead.status === 'CONVERTED' || lead.client_id) {
      throw new ValidationError('Este lead já foi convertido em cliente.');
    }

    if (!lead.name && !lead.company_name) {
      throw new ValidationError('Lead precisa ter ao menos um nome ou razão social para virar cliente.');
    }

    // Cria o cliente baseado nos dados do lead usando uma Transação Segura
    const result = await this.db.$transaction(async (prisma) => {
      const newClient = await prisma.client.create({
        data: {
          phone: lead.phone,
          type: lead.type || 'PF',
          name: lead.name || lead.company_name || 'Cliente Convertido',
          company_name: lead.company_name,
          email: lead.email,
          notes: `Convertido a partir do Lead em ${new Date().toLocaleDateString('pt-BR')}. Interesse original: ${lead.interest || 'Não informado'}`,
        }
      });

      // Atualiza o lead marcando o sucesso
      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: { 
          status: 'CONVERTED', 
          converted_at: new Date(), 
          client_id: newClient.id 
        }
      });

      return { client: newClient, lead: updatedLead };
    });

    return result;
  }

  // ─── 5. Timeline e Interações ──────────────────────────────

  async getLeadTimeline(leadId: string) {
    await this.getLeadById(leadId);
    return this.db.leadFollowUp.findMany({
      where: { lead_id: leadId },
      orderBy: { sent_at: 'desc' },
    });
  }

  async registerFollowUp(leadId: string, input: RegisterFollowUpInput) {
    await this.getLeadById(leadId);
    
    const followup = await this.db.leadFollowUp.create({
      data: {
        lead_id: leadId,
        message: input.message,
        template: input.template,
        responded: input.responded,
      }
    });

    // Atualiza a data de último contato e recalcula o score caso ele tenha respondido
    await this.db.lead.update({ where: { id: leadId }, data: { last_contact: new Date() } });
    if (input.responded) await this.scoreLead(leadId);

    return followup;
  }

  // ─── 6. Analytics e Relatórios ─────────────────────────────

  async getLeadConversionRate(days: number) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);

    const [totalLeads, convertedLeads] = await Promise.all([
      this.db.lead.count({ where: { created_at: { gte: targetDate } } }),
      this.db.lead.count({ where: { created_at: { gte: targetDate }, status: 'CONVERTED' } }),
    ]);

    const rate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : '0.00';

    return {
      period_days: days,
      total_leads: totalLeads,
      converted: convertedLeads,
      conversion_rate_percentage: `${rate}%`
    };
  }

  async getLeadSourceReport(days: number) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);

    // Agrupa leads pela origem e conta quantos em cada
    const grouping = await this.db.lead.groupBy({
      by: ['source'],
      where: { created_at: { gte: targetDate } },
      _count: { source: true },
    });

    return grouping.map(g => ({
      source: g.source,
      count: g._count.source
    }));
  }

  async exportCSV(): Promise<string> {
    const leads = await this.db.lead.findMany({ orderBy: { created_at: 'desc' } });
    
    let csv = 'ID,TELEFONE,NOME,TEMPERATURA,SCORE,STATUS,ORIGEM,CRIADO_EM\n';
    leads.forEach(l => {
      const date = l.created_at.toISOString().split('T')[0];
      const safeName = `"${(l.name || l.company_name || 'Sem nome').replace(/"/g, '""')}"`;
      csv += `${l.id},${l.phone},${safeName},${l.temperature},${l.score},${l.status},${l.source},${date}\n`;
    });

    return csv;
  }

  // ─── Auxiliares ────────────────────────────────────────────

  private async getLeadById(id: string) {
    const lead = await this.db.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }
}