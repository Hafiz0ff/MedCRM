-- CreateTable
CREATE TABLE "integrations"."integration_inbox" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "message_type" VARCHAR(120) NOT NULL,
    "payload_raw" TEXT NOT NULL,
    "payload_json" JSONB,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "status" VARCHAR(20) NOT NULL,
    "last_error" TEXT,

    CONSTRAINT "integration_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations"."external_id_map" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "internal_id" VARCHAR(255) NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_id_map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_inbox_provider_id_external_id_key" ON "integrations"."integration_inbox"("provider_id", "external_id");

-- CreateIndex
CREATE INDEX "external_id_map_tenant_id_entity_type_internal_id_idx" ON "integrations"."external_id_map"("tenant_id", "entity_type", "internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_id_map_provider_id_entity_type_external_id_key" ON "integrations"."external_id_map"("provider_id", "entity_type", "external_id");

-- AddForeignKey
ALTER TABLE "integrations"."integration_inbox" ADD CONSTRAINT "integration_inbox_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "integrations"."integration_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations"."integration_inbox" ADD CONSTRAINT "integration_inbox_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations"."external_id_map" ADD CONSTRAINT "external_id_map_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "integrations"."integration_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations"."external_id_map" ADD CONSTRAINT "external_id_map_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
