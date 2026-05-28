-- AlterTable
ALTER TABLE "platform"."tenants" ADD COLUMN     "accent_color" VARCHAR(40),
ADD COLUMN     "brand_color" VARCHAR(40),
ADD COLUMN     "custom_domain" VARCHAR(255),
ADD COLUMN     "favicon_url" VARCHAR(2048),
ADD COLUMN     "logo_url" VARCHAR(2048),
ADD COLUMN     "region" VARCHAR(80);
