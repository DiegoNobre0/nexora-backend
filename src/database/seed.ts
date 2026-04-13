import { masterDb } from './master';
import { getBusinessClient } from './business-manager';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Iniciando seed do Nexora...');

  const passwordHash = await bcrypt.hash('123456', 10);

  // --------------------------------------------------------
  // MASTER DB — Planos
  // --------------------------------------------------------
  console.log('📦 Criando planos...');

  const planStarter = await masterDb.plan.upsert({
    where: { id: 'plan-starter' },
    update: {},
    create: {
      id: 'plan-starter',
      name: 'Starter',
      price: 67.00,
      max_employees: 1,
      features: {
        max_users: 1,
        max_orders_month: 200,
        max_products: 50,
        bot_ai: false,
        leads_crm: false,
        nfce: false,
        nfe: false,
        multi_unit: false,
        cash_register: false,
        boleto: false,
      }
    }
  });

  const planPro = await masterDb.plan.upsert({
    where: { id: 'plan-pro' },
    update: {},
    create: {
      id: 'plan-pro',
      name: 'Pro',
      price: 127.00,
      max_employees: 3,
      features: {
        max_users: 3,
        max_orders_month: -1,
        max_products: -1,
        bot_ai: true,
        leads_crm: true,
        nfce: true,
        nfe: false,
        multi_unit: false,
        cash_register: true,
        boleto: true,
      }
    }
  });

  const planBusiness = await masterDb.plan.upsert({
    where: { id: 'plan-business' },
    update: {},
    create: {
      id: 'plan-business',
      name: 'Business',
      price: 247.00,
      max_employees: -1,
      features: {
        max_users: -1,
        max_orders_month: -1,
        max_products: -1,
        bot_ai: true,
        leads_crm: true,
        nfce: true,
        nfe: true,
        multi_unit: true,
        cash_register: true,
        boleto: true,
      }
    }
  });

  console.log('✅ Planos criados:', planStarter.name, planPro.name, planBusiness.name);

  // --------------------------------------------------------
  // MASTER DB — Empresa de teste
  // --------------------------------------------------------
  console.log('🏪 Criando empresa de teste...');

  const company = await masterDb.company.upsert({
    where: { slug: 'mercado-do-joao' },
    update: {},
    create: {
      name: 'Mercado do João',
      slug: 'mercado-do-joao',
      business_db_name: 'db_business_joao',
      whatsapp_number: '5511999999999',
      document: '12345678000190',
      is_active: true,
    }
  });

  // --------------------------------------------------------
  // MASTER DB — Usuário dono
  // --------------------------------------------------------
  const user = await masterDb.user.upsert({
    where: { email: 'joao@mercado.com' },
    update: {},
    create: {
      company_id: company.id,
      name: 'João Silva',
      email: 'joao@mercado.com',
      password_hash: passwordHash,
      role: 'OWNER',
    }
  });

  // --------------------------------------------------------
  // MASTER DB — Assinatura Pro (trial)
  // --------------------------------------------------------
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  await masterDb.subscription.upsert({
    where: { id: 'sub-teste-joao' },
    update: {},
    create: {
      id: 'sub-teste-joao',
      company_id: company.id,
      plan_id: planPro.id,
      status: 'TRIALING',
      current_period_start: now,
      current_period_end: trialEnd,
    }
  });

  console.log('✅ Empresa e usuário criados');

  // --------------------------------------------------------
  // BUSINESS DB — conecta no banco da empresa
  // --------------------------------------------------------
  console.log('🔌 Conectando ao banco da empresa...');
  const businessDb = await getBusinessClient(company.business_db_name);

  // --------------------------------------------------------
  // BUSINESS DB — Categorias
  // --------------------------------------------------------
  console.log('🗂️ Criando categorias...');

  const categories = [
    { name: 'Alimentos',       slug: 'alimentos' },
    { name: 'Bebidas',         slug: 'bebidas' },
    { name: 'Limpeza',         slug: 'limpeza' },
    { name: 'Higiene Pessoal', slug: 'higiene-pessoal' },
    { name: 'Frios e Laticínios', slug: 'frios-e-laticinios' },
    { name: 'Padaria',         slug: 'padaria' },
    { name: 'Hortifruti',      slug: 'hortifruti' },
    { name: 'Outros',          slug: 'outros' },
  ];

  for (const cat of categories) {
    await businessDb.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, is_active: true },
    });
  }

  console.log('✅ Categorias criadas:', categories.length);

  // --------------------------------------------------------
  // BUSINESS DB — Taxas padrão
  // --------------------------------------------------------
  console.log('💳 Criando taxas padrão...');

  const taxes = [
    // PIX
    {
      name: 'Pix',
      type: 'PERCENTAGE' as const,
      method: 'PIX' as const,
      rate: 0.0099,       // 0,99%
      fixed_amount: 0,
      pass_to_client: false,
      is_active: true,
    },
    // DÉBITO
    {
      name: 'Débito — Visa / Master',
      type: 'PERCENTAGE' as const,
      method: 'DEBIT_CARD' as const,
      brand: 'VISA_MASTER',
      rate: 0.0149,       // 1,49%
      fixed_amount: 0,
      pass_to_client: false,
      is_active: true,
    },
    // CRÉDITO À VISTA
    {
      name: 'Crédito à vista',
      type: 'PERCENTAGE' as const,
      method: 'CREDIT_CARD' as const,
      brand: 'VISA_MASTER',
      installments: 1,
      rate: 0.0299,       // 2,99%
      fixed_amount: 0,
      pass_to_client: false,
      is_active: true,
    },
    // CRÉDITO 2x–6x
    {
      name: 'Crédito parcelado 2x–6x',
      type: 'PERCENTAGE' as const,
      method: 'CREDIT_CARD' as const,
      brand: 'VISA_MASTER',
      installments: 6,
      rate: 0.0399,       // 3,99%
      fixed_amount: 0,
      pass_to_client: false,
      is_active: true,
    },
    // CRÉDITO 7x–12x
    {
      name: 'Crédito parcelado 7x–12x',
      type: 'PERCENTAGE' as const,
      method: 'CREDIT_CARD' as const,
      brand: 'VISA_MASTER',
      installments: 12,
      rate: 0.0499,       // 4,99%
      fixed_amount: 0,
      pass_to_client: false,
      is_active: true,
    },
    // BOLETO
    {
      name: 'Boleto Bancário',
      type: 'MIXED' as const,
      method: 'BOLETO' as const,
      rate: 0.0199,       // 1,99%
      fixed_amount: 3.49, // R$ 3,49 fixo por boleto
      pass_to_client: false,
      is_active: true,
    },
    // VR/VA — Alelo
    {
      name: 'VR/VA — Alelo',
      type: 'PERCENTAGE' as const,
      method: 'VR' as const,
      brand: 'ALELO',
      rate: 0.0249,
      fixed_amount: 0,
      pass_to_client: false,
      is_active: true,
    },
    // VR/VA — Sodexo
    {
      name: 'VR/VA — Sodexo',
      type: 'PERCENTAGE' as const,
      method: 'VA' as const,
      brand: 'SODEXO',
      rate: 0.0249,
      fixed_amount: 0,
      pass_to_client: false,
      is_active: true,
    },
  ];

  for (const tax of taxes) {
    await businessDb.tax.create({ data: tax });
  }

  console.log('✅ Taxas criadas:', taxes.length);

  // --------------------------------------------------------
  // BUSINESS DB — Zonas de entrega padrão
  // --------------------------------------------------------
  console.log('🚚 Criando zonas de entrega...');

  await businessDb.deliveryZone.createMany({
    data: [
      {
        name: 'Até 2km',
        type: 'RADIUS_KM',
        value: '2',
        fee: 5.00,
        free_above: 80.00,
        is_active: true,
      },
      {
        name: 'De 2km a 5km',
        type: 'RADIUS_KM',
        value: '5',
        fee: 8.00,
        free_above: 120.00,
        is_active: true,
      },
      {
        name: 'De 5km a 10km',
        type: 'RADIUS_KM',
        value: '10',
        fee: 12.00,
        free_above: 200.00,
        is_active: true,
      },
    ]
  });

  console.log('✅ Zonas de entrega criadas');

  // --------------------------------------------------------
  // BUSINESS DB — Config inicial
  // --------------------------------------------------------
  console.log('⚙️ Criando configuração inicial...');

  await businessDb.config.create({
    data: {
      whatsapp_number: '5511999999999',
      whatsapp_token: '',        // preencher após setup Meta
      whatsapp_phone_id: '',     // preencher após setup Meta
      whatsapp_waba_id: '',      // preencher após setup Meta
      auto_reply: true,
      ai_prompt: `Você é um assistente virtual do Mercado do João.
Seja simpático, objetivo e profissional.
Ajude o cliente a fazer pedidos, tirar dúvidas sobre produtos, 
preços, horários de funcionamento e formas de pagamento.
Não invente informações. Se não souber, encaminhe para um atendente.`,
      out_of_hours_message: `Olá! 😊 Obrigado por entrar em contato com o Mercado do João.
No momento estamos fora do horário de atendimento.
Nosso horário é de segunda a sábado, das 8h às 20h.
Assim que abrirmos, retornaremos seu contato!`,
      operating_hours: {
        monday:    { open: '08:00', close: '20:00', active: true },
        tuesday:   { open: '08:00', close: '20:00', active: true },
        wednesday: { open: '08:00', close: '20:00', active: true },
        thursday:  { open: '08:00', close: '20:00', active: true },
        friday:    { open: '08:00', close: '20:00', active: true },
        saturday:  { open: '08:00', close: '18:00', active: true },
        sunday:    { open: '00:00', close: '00:00', active: false },
      },
      holiday_dates: [],
      min_order_amount: 20.00,
      free_delivery_above: 80.00,
    }
  });

  console.log('✅ Configuração criada');

  // --------------------------------------------------------
  // RESUMO FINAL
  // --------------------------------------------------------
  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('─────────────────────────────────');
  console.log(`🏪 Empresa  : ${company.name}`);
  console.log(`👤 Email    : ${user.email}`);
  console.log(`🔑 Senha    : 123456`);
  console.log(`📦 Plano    : Pro (trial 14 dias)`);
  console.log(`🗂️ Categorias: ${categories.length}`);
  console.log(`💳 Taxas    : ${taxes.length}`);
  console.log('─────────────────────────────────');
}

main()
  .catch(e => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await masterDb.$disconnect();
  });