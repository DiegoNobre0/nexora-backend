/*
  Warnings:

  - You are about to drop the column `image_url_3` on the `PromoKit` table. All the data in the column will be lost.
  - You are about to drop the column `image_url_4` on the `PromoKit` table. All the data in the column will be lost.
  - You are about to drop the column `image_url_5` on the `PromoKit` table. All the data in the column will be lost.
  - You are about to drop the column `image_url_6` on the `PromoKit` table. All the data in the column will be lost.
  - You are about to drop the column `image_url_7` on the `PromoKit` table. All the data in the column will be lost.
  - You are about to drop the column `image_url_8` on the `PromoKit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PromoKit" DROP COLUMN "image_url_3",
DROP COLUMN "image_url_4",
DROP COLUMN "image_url_5",
DROP COLUMN "image_url_6",
DROP COLUMN "image_url_7",
DROP COLUMN "image_url_8";
