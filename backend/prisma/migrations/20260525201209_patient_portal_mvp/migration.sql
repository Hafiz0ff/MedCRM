-- CreateTable
CREATE TABLE "patient_portal_accounts" (
    "id" UUID NOT NULL,
    "phone_e164" VARCHAR(20) NOT NULL,
    "phone_bi" VARCHAR(64) NOT NULL,
    "email_e164" VARCHAR(255),
    "first_name" VARCHAR(120),
    "last_name" VARCHAR(120),
    "birth_date" DATE,
    "gender" VARCHAR(16),
    "twofa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "twofa_secret_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patient_portal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_grants" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "state" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "granted_via" VARCHAR(40),
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "patient_portal_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "device_fingerprint" VARCHAR(128),
    "ip_address" INET,
    "user_agent" TEXT,
    "refresh_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_otps" (
    "id" UUID NOT NULL,
    "phone_e164" VARCHAR(20) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "channel" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_portal_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_portal_accounts_phone_e164_key" ON "patient_portal_accounts"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "patient_portal_accounts_email_e164_key" ON "patient_portal_accounts"("email_e164");

-- CreateIndex
CREATE INDEX "patient_portal_grants_tenant_id_patient_id_idx" ON "patient_portal_grants"("tenant_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_portal_grants_account_id_tenant_id_patient_id_key" ON "patient_portal_grants"("account_id", "tenant_id", "patient_id");

-- CreateIndex
CREATE INDEX "patient_portal_otps_phone_e164_created_at_idx" ON "patient_portal_otps"("phone_e164", "created_at");

-- AddForeignKey
ALTER TABLE "patient_portal_grants" ADD CONSTRAINT "patient_portal_grants_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_portal_grants" ADD CONSTRAINT "patient_portal_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_portal_grants" ADD CONSTRAINT "patient_portal_grants_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_portal_sessions" ADD CONSTRAINT "patient_portal_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
