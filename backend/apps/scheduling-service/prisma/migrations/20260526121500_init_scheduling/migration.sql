-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "scheduling";

-- CreateTable
CREATE TABLE "scheduling"."appointments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "service_id" UUID,
    "appointment_number" VARCHAR(120) NOT NULL,
    "booking_source" VARCHAR(60) NOT NULL,
    "appointment_type" VARCHAR(60) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'SCHEDULED',
    "priority" VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "checked_in_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."appointment_status_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "old_status" VARCHAR(40),
    "new_status" VARCHAR(40) NOT NULL,
    "changed_by" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."appointment_resources" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "resource_type" VARCHAR(40) NOT NULL,
    "resource_id" UUID NOT NULL,
    "reserved_from" TIMESTAMPTZ(6) NOT NULL,
    "reserved_to" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointment_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."appointment_reservations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slot_key" VARCHAR(255) NOT NULL,
    "reserved_by" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."room_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "color" VARCHAR(40),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."rooms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "department_id" UUID,
    "room_type_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "floor" INTEGER,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "schedule_json" JSONB,
    "status" VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."room_specialties" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "specialty_id" UUID NOT NULL,

    CONSTRAINT "room_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."equipment_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."equipment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "room_id" UUID,
    "category_id" UUID NOT NULL,
    "inventory_number" VARCHAR(120) NOT NULL,
    "serial_number" VARCHAR(120),
    "name" VARCHAR(255) NOT NULL,
    "manufacturer" VARCHAR(255),
    "model" VARCHAR(255),
    "purchase_date" DATE,
    "maintenance_date" DATE,
    "calibration_date" DATE,
    "status" VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    "is_shared_resource" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."room_equipment" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "installed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(6),

    CONSTRAINT "room_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."employee_room_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "department_id" UUID,
    "room_id" UUID NOT NULL,
    "specialty_id" UUID,
    "active_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_to" TIMESTAMPTZ(6),
    "work_schedule_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_room_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."working_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "break_start" VARCHAR(10),
    "break_end" VARCHAR(10),
    "recurrence_rule" TEXT,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Europe/Moscow',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "working_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."schedule_exceptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "exception_date" DATE NOT NULL,
    "reason" TEXT,
    "start_time" VARCHAR(10),
    "end_time" VARCHAR(10),
    "is_day_off" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."waiting_lists" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "employee_id" UUID,
    "preferred_date_from" DATE NOT NULL,
    "preferred_date_to" DATE NOT NULL,
    "preferred_time_from" VARCHAR(10),
    "preferred_time_to" VARCHAR(10),
    "service_id" UUID,
    "priority" VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "status" VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waiting_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."availability_caches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "available_slots_json" JSONB NOT NULL,
    "recalculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."resource_buffers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "resource_type" VARCHAR(40) NOT NULL,
    "resource_id" UUID NOT NULL,
    "before_minutes" INTEGER NOT NULL DEFAULT 0,
    "after_minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "resource_buffers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."service_required_resources" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "resource_type" VARCHAR(40) NOT NULL,
    "resource_category_id" UUID NOT NULL,

    CONSTRAINT "service_required_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."appointment_recurrence_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "recurrence_type" VARCHAR(40) NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "end_date" DATE,

    CONSTRAINT "appointment_recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."appointment_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "notification_type" VARCHAR(60) NOT NULL,
    "channel" VARCHAR(40) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."online_booking_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_booking_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."receptionist_dashboards_cache" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "dashboard_date" DATE NOT NULL,
    "dashboard_json" JSONB NOT NULL,
    "recalculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receptionist_dashboards_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."appointment_visit_states" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "old_state" VARCHAR(40) NOT NULL,
    "new_state" VARCHAR(40) NOT NULL,
    "changed_by" UUID NOT NULL,
    "workstation_type" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_visit_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."visit_queue" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "queue_number" VARCHAR(40) NOT NULL,
    "queue_status" VARCHAR(40) NOT NULL,
    "priority" VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
    "estimated_wait_time" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."incoming_calls" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "phone_number" VARCHAR(60) NOT NULL,
    "patient_id" UUID,
    "operator_user_id" UUID,
    "call_started_at" TIMESTAMPTZ(6) NOT NULL,
    "call_ended_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,
    "call_result" VARCHAR(40) NOT NULL,
    "recording_file_id" UUID,

    CONSTRAINT "incoming_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_tenant_id_branch_id_start_at_end_at_idx" ON "scheduling"."appointments"("tenant_id", "branch_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_employee_id_start_at_end_at_idx" ON "scheduling"."appointments"("tenant_id", "employee_id", "start_at", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_tenant_id_appointment_number_key" ON "scheduling"."appointments"("tenant_id", "appointment_number");

-- CreateIndex
CREATE INDEX "appointment_status_history_tenant_id_appointment_id_created_idx" ON "scheduling"."appointment_status_history"("tenant_id", "appointment_id", "created_at");

-- CreateIndex
CREATE INDEX "appointment_resources_tenant_id_resource_type_resource_id_r_idx" ON "scheduling"."appointment_resources"("tenant_id", "resource_type", "resource_id", "reserved_from", "reserved_to");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_reservations_tenant_id_slot_key_key" ON "scheduling"."appointment_reservations"("tenant_id", "slot_key");

-- CreateIndex
CREATE UNIQUE INDEX "room_types_tenant_id_code_key" ON "scheduling"."room_types"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_tenant_id_branch_id_code_key" ON "scheduling"."rooms"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "room_specialties_room_id_specialty_id_key" ON "scheduling"."room_specialties"("room_id", "specialty_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_categories_tenant_id_code_key" ON "scheduling"."equipment_categories"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_tenant_id_inventory_number_key" ON "scheduling"."equipment"("tenant_id", "inventory_number");

-- CreateIndex
CREATE INDEX "working_schedules_tenant_id_entity_type_entity_id_idx" ON "scheduling"."working_schedules"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "schedule_exceptions_tenant_id_entity_type_entity_id_excepti_idx" ON "scheduling"."schedule_exceptions"("tenant_id", "entity_type", "entity_id", "exception_date");

-- CreateIndex
CREATE UNIQUE INDEX "availability_caches_tenant_id_employee_id_branch_id_date_key" ON "scheduling"."availability_caches"("tenant_id", "employee_id", "branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "resource_buffers_tenant_id_resource_type_resource_id_key" ON "scheduling"."resource_buffers"("tenant_id", "resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_required_resources_service_id_resource_type_resourc_key" ON "scheduling"."service_required_resources"("service_id", "resource_type", "resource_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_recurrence_rules_appointment_id_key" ON "scheduling"."appointment_recurrence_rules"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "online_booking_tokens_token_key" ON "scheduling"."online_booking_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "receptionist_dashboards_cache_tenant_id_branch_id_dashboard_key" ON "scheduling"."receptionist_dashboards_cache"("tenant_id", "branch_id", "dashboard_date");

-- AddForeignKey
ALTER TABLE "scheduling"."appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "scheduling"."appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."appointment_resources" ADD CONSTRAINT "appointment_resources_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "scheduling"."appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."rooms" ADD CONSTRAINT "rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "scheduling"."room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."room_specialties" ADD CONSTRAINT "room_specialties_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "scheduling"."rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."equipment" ADD CONSTRAINT "equipment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "scheduling"."rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."equipment" ADD CONSTRAINT "equipment_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scheduling"."equipment_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."room_equipment" ADD CONSTRAINT "room_equipment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "scheduling"."rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."room_equipment" ADD CONSTRAINT "room_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "scheduling"."equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."employee_room_assignments" ADD CONSTRAINT "employee_room_assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "scheduling"."rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."appointment_recurrence_rules" ADD CONSTRAINT "appointment_recurrence_rules_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "scheduling"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."appointment_notifications" ADD CONSTRAINT "appointment_notifications_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "scheduling"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."appointment_visit_states" ADD CONSTRAINT "appointment_visit_states_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "scheduling"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."visit_queue" ADD CONSTRAINT "visit_queue_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "scheduling"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
