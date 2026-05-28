-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reference";

-- DropForeignKey
ALTER TABLE "integrations"."medical_devices" DROP CONSTRAINT "medical_devices_room_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory"."warehouses" DROP CONSTRAINT "warehouses_room_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointment_notifications" DROP CONSTRAINT "appointment_notifications_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointment_recurrence_rules" DROP CONSTRAINT "appointment_recurrence_rules_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointment_visit_states" DROP CONSTRAINT "appointment_visit_states_changed_by_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointment_visit_states" DROP CONSTRAINT "appointment_visit_states_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointments" DROP CONSTRAINT "appointments_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointments" DROP CONSTRAINT "appointments_created_by_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointments" DROP CONSTRAINT "appointments_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointments" DROP CONSTRAINT "appointments_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointments" DROP CONSTRAINT "appointments_service_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."appointments" DROP CONSTRAINT "appointments_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."availability_caches" DROP CONSTRAINT "availability_caches_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."availability_caches" DROP CONSTRAINT "availability_caches_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."availability_caches" DROP CONSTRAINT "availability_caches_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."employee_room_assignments" DROP CONSTRAINT "employee_room_assignments_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."employee_room_assignments" DROP CONSTRAINT "employee_room_assignments_department_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."employee_room_assignments" DROP CONSTRAINT "employee_room_assignments_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."employee_room_assignments" DROP CONSTRAINT "employee_room_assignments_specialty_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."employee_room_assignments" DROP CONSTRAINT "employee_room_assignments_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."equipment" DROP CONSTRAINT "equipment_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."equipment" DROP CONSTRAINT "equipment_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."equipment_categories" DROP CONSTRAINT "equipment_categories_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."incoming_calls" DROP CONSTRAINT "incoming_calls_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."incoming_calls" DROP CONSTRAINT "incoming_calls_operator_user_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."incoming_calls" DROP CONSTRAINT "incoming_calls_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."incoming_calls" DROP CONSTRAINT "incoming_calls_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."online_booking_tokens" DROP CONSTRAINT "online_booking_tokens_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."online_booking_tokens" DROP CONSTRAINT "online_booking_tokens_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."receptionist_dashboards_cache" DROP CONSTRAINT "receptionist_dashboards_cache_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."receptionist_dashboards_cache" DROP CONSTRAINT "receptionist_dashboards_cache_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."resource_buffers" DROP CONSTRAINT "resource_buffers_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."room_specialties" DROP CONSTRAINT "room_specialties_specialty_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."room_types" DROP CONSTRAINT "room_types_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."rooms" DROP CONSTRAINT "rooms_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."rooms" DROP CONSTRAINT "rooms_department_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."rooms" DROP CONSTRAINT "rooms_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."schedule_exceptions" DROP CONSTRAINT "schedule_exceptions_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."service_required_resources" DROP CONSTRAINT "service_required_resources_service_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."service_required_resources" DROP CONSTRAINT "service_required_resources_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."visit_queue" DROP CONSTRAINT "visit_queue_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."visit_queue" DROP CONSTRAINT "visit_queue_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."waiting_lists" DROP CONSTRAINT "waiting_lists_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."waiting_lists" DROP CONSTRAINT "waiting_lists_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."waiting_lists" DROP CONSTRAINT "waiting_lists_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."waiting_lists" DROP CONSTRAINT "waiting_lists_service_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."waiting_lists" DROP CONSTRAINT "waiting_lists_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduling"."working_schedules" DROP CONSTRAINT "working_schedules_tenant_id_fkey";

-- AlterTable
ALTER TABLE "emr"."prescription_items" ADD COLUMN     "cds_overridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cds_override_reason" TEXT,
ADD COLUMN     "dose" DECIMAL(12,4),
ADD COLUMN     "dose_unit" VARCHAR(40),
ADD COLUMN     "duration_days" INTEGER,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "frequency_per_day" INTEGER,
ADD COLUMN     "inn_code" VARCHAR(120),
ADD COLUMN     "interval_hours" INTEGER,
ADD COLUMN     "medicinal_product_id" UUID,
ADD COLUMN     "start_date" DATE;

-- CreateTable
CREATE TABLE "emr"."patient_allergies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "allergen_code" VARCHAR(80) NOT NULL,
    "severity" VARCHAR(40) NOT NULL,
    "criticality" VARCHAR(40),
    "clinical_status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "verification_status" VARCHAR(40) NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr"."patient_chronic_conditions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "icd_code" VARCHAR(80) NOT NULL,
    "clinical_status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "verification_status" VARCHAR(40) NOT NULL DEFAULT 'confirmed',
    "onset_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_chronic_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr"."patient_pregnancy_states" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "estimated_delivery_date" DATE,
    "status" VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patient_pregnancy_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr"."vital_signs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "type" VARCHAR(40) NOT NULL,
    "value" DECIMAL(10,3) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "measured_at" TIMESTAMPTZ(6) NOT NULL,
    "context" VARCHAR(60),
    "alert_level" VARCHAR(20),

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr"."vital_alert_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "vital_type" VARCHAR(40) NOT NULL,
    "min_normal" DECIMAL(10,3),
    "max_normal" DECIMAL(10,3),
    "min_critical" DECIMAL(10,3),
    "max_critical" DECIMAL(10,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vital_alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr"."lab_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "service_order_id" UUID,
    "lab_provider" VARCHAR(120),
    "collected_at" TIMESTAMPTZ(6),
    "reported_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "raw_json" JSONB,

    CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr"."lab_result_items" (
    "id" UUID NOT NULL,
    "lab_report_id" UUID NOT NULL,
    "loinc_code" VARCHAR(40),
    "analyte_code" VARCHAR(80) NOT NULL,
    "analyte_name" VARCHAR(255) NOT NULL,
    "value" DECIMAL(18,6),
    "value_text" VARCHAR(255),
    "unit" VARCHAR(40),
    "ref_range_low" DECIMAL(18,6),
    "ref_range_high" DECIMAL(18,6),
    "flag" VARCHAR(10),
    "abnormality" VARCHAR(40),

    CONSTRAINT "lab_result_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr"."dental_chart_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "tooth_code" INTEGER NOT NULL,
    "surface" VARCHAR(20),
    "diagnosis_code" VARCHAR(80),
    "procedure_code" VARCHAR(120),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dental_chart_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr"."dental_procedure_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_ru" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dental_procedure_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference"."reference_icd_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 10,
    "parent_code" VARCHAR(80),
    "title" VARCHAR(500) NOT NULL,
    "title_ru" VARCHAR(500),
    "title_tj" VARCHAR(500),
    "title_en" VARCHAR(500),
    "is_leaf" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_icd_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference"."reference_inns" (
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_ru" VARCHAR(255),
    "name_tj" VARCHAR(255),
    "atx_code" VARCHAR(40),
    "fda_pregnancy_category" VARCHAR(10),
    "requires_renal_adjustment" BOOLEAN NOT NULL DEFAULT false,
    "requires_hepatic_adjustment" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_inns_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "reference"."reference_medicinal_products" (
    "id" UUID NOT NULL,
    "inn_code" VARCHAR(120) NOT NULL,
    "trade_name" VARCHAR(255) NOT NULL,
    "manufacturer" VARCHAR(255),
    "dosage_form" VARCHAR(120),
    "strength" VARCHAR(100),
    "country" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_medicinal_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference"."reference_allergens" (
    "code" VARCHAR(80) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "title_ru" VARCHAR(255),
    "inn_code" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_allergens_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "reference"."reference_ddis" (
    "id" UUID NOT NULL,
    "inn_code_a" VARCHAR(120) NOT NULL,
    "inn_code_b" VARCHAR(120) NOT NULL,
    "severity" VARCHAR(40) NOT NULL,
    "mechanism" TEXT,
    "recommendation" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_ddis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference"."reference_units" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_ru" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_units_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "reference"."reference_dosage_forms" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_ru" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_dosage_forms_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "reference"."reference_routes" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_ru" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_routes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "reference"."reference_loinc_codes" (
    "code" VARCHAR(40) NOT NULL,
    "component" VARCHAR(255) NOT NULL,
    "system" VARCHAR(100) NOT NULL,
    "scale" VARCHAR(40) NOT NULL,
    "class" VARCHAR(100) NOT NULL,
    "title_ru" VARCHAR(255),
    "reference_range" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_loinc_codes_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "vital_signs_patient_id_type_measured_at_idx" ON "emr"."vital_signs"("patient_id", "type", "measured_at");

-- CreateIndex
CREATE UNIQUE INDEX "dental_procedure_templates_code_key" ON "emr"."dental_procedure_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reference_icd_codes_code_key" ON "reference"."reference_icd_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reference_ddis_inn_code_a_inn_code_b_key" ON "reference"."reference_ddis"("inn_code_a", "inn_code_b");

-- AddForeignKey
ALTER TABLE "emr"."prescription_items" ADD CONSTRAINT "prescription_items_inn_code_fkey" FOREIGN KEY ("inn_code") REFERENCES "reference"."reference_inns"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."prescription_items" ADD CONSTRAINT "prescription_items_medicinal_product_id_fkey" FOREIGN KEY ("medicinal_product_id") REFERENCES "reference"."reference_medicinal_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."patient_allergies" ADD CONSTRAINT "patient_allergies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."patient_allergies" ADD CONSTRAINT "patient_allergies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."patient_allergies" ADD CONSTRAINT "patient_allergies_allergen_code_fkey" FOREIGN KEY ("allergen_code") REFERENCES "reference"."reference_allergens"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."patient_chronic_conditions" ADD CONSTRAINT "patient_chronic_conditions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."patient_chronic_conditions" ADD CONSTRAINT "patient_chronic_conditions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."patient_pregnancy_states" ADD CONSTRAINT "patient_pregnancy_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."patient_pregnancy_states" ADD CONSTRAINT "patient_pregnancy_states_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."vital_signs" ADD CONSTRAINT "vital_signs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."vital_signs" ADD CONSTRAINT "vital_signs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."vital_signs" ADD CONSTRAINT "vital_signs_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "emr"."encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."vital_alert_rules" ADD CONSTRAINT "vital_alert_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."lab_reports" ADD CONSTRAINT "lab_reports_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."lab_reports" ADD CONSTRAINT "lab_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."lab_result_items" ADD CONSTRAINT "lab_result_items_lab_report_id_fkey" FOREIGN KEY ("lab_report_id") REFERENCES "emr"."lab_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."dental_chart_entries" ADD CONSTRAINT "dental_chart_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."dental_chart_entries" ADD CONSTRAINT "dental_chart_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr"."dental_chart_entries" ADD CONSTRAINT "dental_chart_entries_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "emr"."encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference"."reference_medicinal_products" ADD CONSTRAINT "reference_medicinal_products_inn_code_fkey" FOREIGN KEY ("inn_code") REFERENCES "reference"."reference_inns"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference"."reference_allergens" ADD CONSTRAINT "reference_allergens_inn_code_fkey" FOREIGN KEY ("inn_code") REFERENCES "reference"."reference_inns"("code") ON DELETE SET NULL ON UPDATE CASCADE;
