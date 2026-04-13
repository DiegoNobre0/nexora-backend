import { masterDb } from '../../../database/master';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class SubscriptionsService {
  
  // Retorna a assinatura atual e os limites do lojista
  async getCurrentSubscription(companyId: string) {
    const sub = await masterDb.subscription.findFirst({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
      include: { plan: true }
    });

    if (!sub) throw new NotFoundError('Assinatura não encontrada para esta empresa.');
    return sub;
  }

  // Lojista fazendo Upgrade/Downgrade de plano
  async changePlan(companyId: string, newPlanId: string) {
    const newPlan = await masterDb.plan.findUnique({ where: { id: newPlanId } });
    if (!newPlan || !newPlan.is_active) throw new ValidationError('Plano inválido ou inativo.');

    const currentSub = await this.getCurrentSubscription(companyId);

    // TODO: Aqui entraria a chamada HTTP para o Stripe/Asaas para mudar o valor da cobrança

    // Atualiza o banco local
    return masterDb.subscription.update({
      where: { id: currentSub.id },
      data: {
        plan_id: newPlan.id,
        updated_at: new Date()
      },
      include: { plan: true }
    });
  }

  // O lojista clica em "Cancelar Assinatura"
  async cancelSubscription(companyId: string) {
    const currentSub = await this.getCurrentSubscription(companyId);
    
    if (currentSub.status === 'CANCELED') throw new ValidationError('Assinatura já está cancelada.');

    // TODO: Cancelar no Stripe/Asaas

    return masterDb.subscription.update({
      where: { id: currentSub.id },
      data: { status: 'CANCELED', updated_at: new Date() }
    });
  }

  // ─── Webhook de Cobrança (O Motor de Acesso) ───
  // Quando o Stripe/Asaas cobra o lojista, ele bate nesta função.
  async handleBillingWebhook(payload: { company_id: string, event_type: string, next_billing_date?: string }) {
    const { company_id, event_type, next_billing_date } = payload;
    const currentSub = await this.getCurrentSubscription(company_id);

    if (event_type === 'PAYMENT_RECEIVED') {
      // Pagou! Renova o acesso.
      await masterDb.subscription.update({
        where: { id: currentSub.id },
        data: {
          status: 'ACTIVE',
          current_period_start: new Date(),
          current_period_end: next_billing_date ? new Date(next_billing_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 dias
        }
      });
      
      // Garante que a empresa está ativa
      await masterDb.company.update({ where: { id: company_id }, data: { is_active: true } });
    } 
    else if (event_type === 'PAYMENT_FAILED') {
      // Cartão recusou ou boleto venceu. Muda status, bloqueando a plataforma.
      await masterDb.subscription.update({
        where: { id: currentSub.id },
        data: { status: 'PAST_DUE' }
      });
    }
    else if (event_type === 'SUBSCRIPTION_CANCELED') {
      await masterDb.subscription.update({
        where: { id: currentSub.id },
        data: { status: 'CANCELED' }
      });
    }

    return { message: 'Status da assinatura atualizado com sucesso.' };
  }
}