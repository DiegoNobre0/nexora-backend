-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PromotionTarget" AS ENUM ('PRODUCT', 'CATEGORY', 'WHOLE_CART');

-- CreateTable
CREATE TABLE "PromoKit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "image_url_1" TEXT,
    "image_url_2" TEXT,
    "image_url_3" TEXT,
    "image_url_4" TEXT,
    "image_url_5" TEXT,
    "image_url_6" TEXT,
    "image_url_7" TEXT,
    "image_url_8" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoKitItem" (
    "id" TEXT NOT NULL,
    "kit_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PromoKitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PromotionType" NOT NULL,
    "target" "PromotionTarget" NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_at" TIMESTAMP(3),
    "days_of_week" TEXT,
    "product_id" TEXT,
    "category_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoKit_is_active_start_at_end_at_idx" ON "PromoKit"("is_active", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "Promotion_is_active_start_at_end_at_idx" ON "Promotion"("is_active", "start_at", "end_at");

-- AddForeignKey
ALTER TABLE "PromoKitItem" ADD CONSTRAINT "PromoKitItem_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "PromoKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoKitItem" ADD CONSTRAINT "PromoKitItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
