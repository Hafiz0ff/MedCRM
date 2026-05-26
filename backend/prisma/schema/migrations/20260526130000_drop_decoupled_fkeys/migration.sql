-- Drop physical cross-schema foreign keys from primary database to decoupled scheduling tables
ALTER TABLE "finance"."invoices" DROP CONSTRAINT IF EXISTS "invoices_appointment_id_fkey";
ALTER TABLE "emr"."encounters" DROP CONSTRAINT IF EXISTS "encounters_appointment_id_fkey";
ALTER TABLE "communications"."notifications_queue" DROP CONSTRAINT IF EXISTS "notifications_queue_appointment_id_fkey";
ALTER TABLE "inventory"."inventory_consumptions" DROP CONSTRAINT IF EXISTS "inventory_consumptions_appointment_id_fkey";
