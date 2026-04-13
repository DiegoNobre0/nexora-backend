import { z } from 'zod';

export const changePlanSchema = z.object({
  new_plan_id: z.string().uuid('ID do plano inválido.'),
});

// Schema para simular o Webhook de um Gateway de Pagamento (ex: Stripe/Asaas)
export const billingWebhookSchema = z.object({
  company_id:  z.string().uuid(),
  event_type:  z.enum(['PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'SUBSCRIPTION_CANCELED']),
  next_billing_date: z.string().datetime().optional(), // Quando o webhook avisa o novo vencimento
});