-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "PriceTable" AS ENUM ('RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WHATSAPP', 'WEBSITE', 'INSTAGRAM', 'REFERRAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadTemp" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'NURTURING', 'CONVERTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WHATSAPP', 'WEBSITE', 'COUNTER', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_DELIVERY', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DELIVERY', 'PICKUP', 'COUNTER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO', 'CASH', 'VR', 'VA', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CashRegisterStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('SALE', 'WITHDRAWAL', 'SUPPLY', 'MANUAL_IN', 'MANUAL_OUT', 'REFUND');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('PERCENTAGE', 'FIXED', 'MIXED');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('RADIUS_KM', 'DISTRICT', 'ZIP_CODE', 'FIXED');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "price_wholesale" DECIMAL(10,2),
    "cost_price" DECIMAL(10,2),
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "stock_min" INTEGER NOT NULL DEFAULT 0,
    "ncm" TEXT,
    "cfop" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_barcodes" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UN',

    CONSTRAINT "product_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'PF',
    "name" TEXT NOT NULL,
    "cpf" TEXT,
    "birth_date" TIMESTAMP(3),
    "company_name" TEXT,
    "trade_name" TEXT,
    "cnpj" TEXT,
    "state_reg" TEXT,
    "municipal_reg" TEXT,
    "contact_name" TEXT,
    "contact_role" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,
    "credit_limit" DECIMAL(10,2),
    "credit_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_terms" INTEGER NOT NULL DEFAULT 0,
    "price_table" "PriceTable" NOT NULL DEFAULT 'RETAIL',
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Principal',
    "zip_code" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "type" "ClientType",
    "company_name" TEXT,
    "email" TEXT,
    "interest" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'WHATSAPP',
    "score" INTEGER NOT NULL DEFAULT 0,
    "temperature" "LeadTemp" NOT NULL DEFAULT 'COLD',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assignee_id" TEXT,
    "notes" TEXT,
    "last_contact" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_follow_ups" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "template" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lead_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_commissions" (
    "employee_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "commission_percentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "employee_commissions_pkey" PRIMARY KEY ("employee_id","product_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "employee_id" TEXT,
    "address_id" TEXT,
    "channel" "OrderChannel" NOT NULL DEFAULT 'WHATSAPP',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "type" "OrderType" NOT NULL DEFAULT 'DELIVERY',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "estimated_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "is_proforma" BOOLEAN NOT NULL DEFAULT false,
    "proforma_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "client_id" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gateway_id" TEXT,
    "boleto_url" TEXT,
    "boleto_barcode" TEXT,
    "boleto_due_date" TIMESTAMP(3),
    "pix_qr_code" TEXT,
    "pix_key" TEXT,
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "refund_reason" TEXT,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "CashRegisterStatus" NOT NULL DEFAULT 'OPEN',
    "opening_balance" DECIMAL(10,2) NOT NULL,
    "closing_balance" DECIMAL(10,2),
    "system_balance" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "diff_reason" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "cash_register_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "type" "MovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TaxType" NOT NULL,
    "method" "PaymentMethod",
    "brand" TEXT,
    "installments" INTEGER,
    "rate" DECIMAL(6,4) NOT NULL,
    "fixed_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pass_to_client" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL,
    "value" TEXT NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL,
    "free_above" DECIMAL(10,2),
    "min_order" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configs" (
    "id" TEXT NOT NULL,
    "whatsapp_number" TEXT,
    "whatsapp_token" TEXT,
    "whatsapp_phone_id" TEXT,
    "whatsapp_waba_id" TEXT,
    "ai_prompt" TEXT,
    "auto_reply" BOOLEAN NOT NULL DEFAULT true,
    "operating_hours" JSONB,
    "holiday_dates" JSONB,
    "out_of_hours_message" TEXT,
    "min_order_amount" DECIMAL(10,2),
    "free_delivery_above" DECIMAL(10,2),

    CONSTRAINT "configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcodes_code_key" ON "product_barcodes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "clients_cpf_key" ON "clients"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "clients_cnpj_key" ON "clients"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_key" ON "clients"("phone");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commissions" ADD CONSTRAINT "employee_commissions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commissions" ADD CONSTRAINT "employee_commissions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
