-- CreateTable
CREATE TABLE "integration_outbox" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload_json" JSONB NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "state" VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "integration_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_outbox_state_scheduled_at_idx" ON "integration_outbox"("state", "scheduled_at");

-- CreateIndex
CREATE INDEX "integration_outbox_tenant_id_aggregate_type_aggregate_id_idx" ON "integration_outbox"("tenant_id", "aggregate_type", "aggregate_id");

-- AddForeignKey
ALTER TABLE "integration_outbox" ADD CONSTRAINT "integration_outbox_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
