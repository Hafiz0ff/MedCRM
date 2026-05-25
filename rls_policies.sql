-- Migration: Enable RLS on tenant-scoped tables

-- 1) Helper functions to get session context variables
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- 2) Enable RLS and create isolation policy for each table
-- Table: appointment_notifications
ALTER TABLE "appointment_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_notifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointment_notifications_tenant_isolation" ON "appointment_notifications";
CREATE POLICY "appointment_notifications_tenant_isolation" ON "appointment_notifications"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: appointment_recurrence_rules
ALTER TABLE "appointment_recurrence_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_recurrence_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointment_recurrence_rules_tenant_isolation" ON "appointment_recurrence_rules";
CREATE POLICY "appointment_recurrence_rules_tenant_isolation" ON "appointment_recurrence_rules"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: appointment_reservations
ALTER TABLE "appointment_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_reservations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointment_reservations_tenant_isolation" ON "appointment_reservations";
CREATE POLICY "appointment_reservations_tenant_isolation" ON "appointment_reservations"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: appointment_resources
ALTER TABLE "appointment_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_resources" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointment_resources_tenant_isolation" ON "appointment_resources";
CREATE POLICY "appointment_resources_tenant_isolation" ON "appointment_resources"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: appointment_status_history
ALTER TABLE "appointment_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_status_history" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointment_status_history_tenant_isolation" ON "appointment_status_history";
CREATE POLICY "appointment_status_history_tenant_isolation" ON "appointment_status_history"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: appointment_visit_states
ALTER TABLE "appointment_visit_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_visit_states" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointment_visit_states_tenant_isolation" ON "appointment_visit_states";
CREATE POLICY "appointment_visit_states_tenant_isolation" ON "appointment_visit_states"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: appointments
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointments_tenant_isolation" ON "appointments";
CREATE POLICY "appointments_tenant_isolation" ON "appointments"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: audit_logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON "audit_logs";
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: availability_caches
ALTER TABLE "availability_caches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "availability_caches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "availability_caches_tenant_isolation" ON "availability_caches";
CREATE POLICY "availability_caches_tenant_isolation" ON "availability_caches"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: branches
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branches_tenant_isolation" ON "branches";
CREATE POLICY "branches_tenant_isolation" ON "branches"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: call_events
ALTER TABLE "call_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "call_events_tenant_isolation" ON "call_events";
CREATE POLICY "call_events_tenant_isolation" ON "call_events"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: cashier_shifts
ALTER TABLE "cashier_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cashier_shifts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashier_shifts_tenant_isolation" ON "cashier_shifts";
CREATE POLICY "cashier_shifts_tenant_isolation" ON "cashier_shifts"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: chatbot_actions_log
ALTER TABLE "chatbot_actions_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chatbot_actions_log" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_actions_log_tenant_isolation" ON "chatbot_actions_log";
CREATE POLICY "chatbot_actions_log_tenant_isolation" ON "chatbot_actions_log"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: chatbot_flows
ALTER TABLE "chatbot_flows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chatbot_flows" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_flows_tenant_isolation" ON "chatbot_flows";
CREATE POLICY "chatbot_flows_tenant_isolation" ON "chatbot_flows"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: clinical_compositions
ALTER TABLE "clinical_compositions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_compositions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_compositions_tenant_isolation" ON "clinical_compositions";
CREATE POLICY "clinical_compositions_tenant_isolation" ON "clinical_compositions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: clinical_elements
ALTER TABLE "clinical_elements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_elements" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_elements_tenant_isolation" ON "clinical_elements";
CREATE POLICY "clinical_elements_tenant_isolation" ON "clinical_elements"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: clinical_observations
ALTER TABLE "clinical_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_observations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_observations_tenant_isolation" ON "clinical_observations";
CREATE POLICY "clinical_observations_tenant_isolation" ON "clinical_observations"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: clinical_sections
ALTER TABLE "clinical_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_sections" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_sections_tenant_isolation" ON "clinical_sections";
CREATE POLICY "clinical_sections_tenant_isolation" ON "clinical_sections"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: clinical_templates
ALTER TABLE "clinical_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_templates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_templates_tenant_isolation" ON "clinical_templates";
CREATE POLICY "clinical_templates_tenant_isolation" ON "clinical_templates"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: communication_campaigns
ALTER TABLE "communication_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_campaigns" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "communication_campaigns_tenant_isolation" ON "communication_campaigns";
CREATE POLICY "communication_campaigns_tenant_isolation" ON "communication_campaigns"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: communication_channels
ALTER TABLE "communication_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_channels" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "communication_channels_tenant_isolation" ON "communication_channels";
CREATE POLICY "communication_channels_tenant_isolation" ON "communication_channels"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: communication_metrics
ALTER TABLE "communication_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "communication_metrics_tenant_isolation" ON "communication_metrics";
CREATE POLICY "communication_metrics_tenant_isolation" ON "communication_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: communication_preferences
ALTER TABLE "communication_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "communication_preferences_tenant_isolation" ON "communication_preferences";
CREATE POLICY "communication_preferences_tenant_isolation" ON "communication_preferences"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: conversation_assignments
ALTER TABLE "conversation_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_assignments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversation_assignments_tenant_isolation" ON "conversation_assignments";
CREATE POLICY "conversation_assignments_tenant_isolation" ON "conversation_assignments"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: conversation_participants
ALTER TABLE "conversation_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_participants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversation_participants_tenant_isolation" ON "conversation_participants";
CREATE POLICY "conversation_participants_tenant_isolation" ON "conversation_participants"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: conversations
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_tenant_isolation" ON "conversations";
CREATE POLICY "conversations_tenant_isolation" ON "conversations"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: crm_tags
ALTER TABLE "crm_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_tags_tenant_isolation" ON "crm_tags";
CREATE POLICY "crm_tags_tenant_isolation" ON "crm_tags"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: departments
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments_tenant_isolation" ON "departments";
CREATE POLICY "departments_tenant_isolation" ON "departments"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: device_measurements
ALTER TABLE "device_measurements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "device_measurements" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device_measurements_tenant_isolation" ON "device_measurements";
CREATE POLICY "device_measurements_tenant_isolation" ON "device_measurements"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: digital_signatures
ALTER TABLE "digital_signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "digital_signatures" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "digital_signatures_tenant_isolation" ON "digital_signatures";
CREATE POLICY "digital_signatures_tenant_isolation" ON "digital_signatures"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: doctor_kpi_metrics
ALTER TABLE "doctor_kpi_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "doctor_kpi_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doctor_kpi_metrics_tenant_isolation" ON "doctor_kpi_metrics";
CREATE POLICY "doctor_kpi_metrics_tenant_isolation" ON "doctor_kpi_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: dw_fact_appointments
ALTER TABLE "dw_fact_appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dw_fact_appointments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dw_fact_appointments_tenant_isolation" ON "dw_fact_appointments";
CREATE POLICY "dw_fact_appointments_tenant_isolation" ON "dw_fact_appointments"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: dw_fact_marketing
ALTER TABLE "dw_fact_marketing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dw_fact_marketing" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dw_fact_marketing_tenant_isolation" ON "dw_fact_marketing";
CREATE POLICY "dw_fact_marketing_tenant_isolation" ON "dw_fact_marketing"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: dw_fact_payments
ALTER TABLE "dw_fact_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dw_fact_payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dw_fact_payments_tenant_isolation" ON "dw_fact_payments";
CREATE POLICY "dw_fact_payments_tenant_isolation" ON "dw_fact_payments"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: employee_positions
ALTER TABLE "employee_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_positions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_positions_tenant_isolation" ON "employee_positions";
CREATE POLICY "employee_positions_tenant_isolation" ON "employee_positions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: employee_room_assignments
ALTER TABLE "employee_room_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_room_assignments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_room_assignments_tenant_isolation" ON "employee_room_assignments";
CREATE POLICY "employee_room_assignments_tenant_isolation" ON "employee_room_assignments"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: employees
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees_tenant_isolation" ON "employees";
CREATE POLICY "employees_tenant_isolation" ON "employees"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: encounter_diagnoses
ALTER TABLE "encounter_diagnoses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounter_diagnoses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounter_diagnoses_tenant_isolation" ON "encounter_diagnoses";
CREATE POLICY "encounter_diagnoses_tenant_isolation" ON "encounter_diagnoses"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: encounter_versions
ALTER TABLE "encounter_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounter_versions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounter_versions_tenant_isolation" ON "encounter_versions";
CREATE POLICY "encounter_versions_tenant_isolation" ON "encounter_versions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: encounters
ALTER TABLE "encounters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounters" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounters_tenant_isolation" ON "encounters";
CREATE POLICY "encounters_tenant_isolation" ON "encounters"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: encryption_keys
ALTER TABLE "encryption_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encryption_keys" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encryption_keys_tenant_isolation" ON "encryption_keys";
CREATE POLICY "encryption_keys_tenant_isolation" ON "encryption_keys"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: episodes_of_care
ALTER TABLE "episodes_of_care" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "episodes_of_care" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "episodes_of_care_tenant_isolation" ON "episodes_of_care";
CREATE POLICY "episodes_of_care_tenant_isolation" ON "episodes_of_care"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: equipment
ALTER TABLE "equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_tenant_isolation" ON "equipment";
CREATE POLICY "equipment_tenant_isolation" ON "equipment"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: equipment_categories
ALTER TABLE "equipment_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment_categories" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_categories_tenant_isolation" ON "equipment_categories";
CREATE POLICY "equipment_categories_tenant_isolation" ON "equipment_categories"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: family_groups
ALTER TABLE "family_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "family_groups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_groups_tenant_isolation" ON "family_groups";
CREATE POLICY "family_groups_tenant_isolation" ON "family_groups"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: family_members
ALTER TABLE "family_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "family_members" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_tenant_isolation" ON "family_members";
CREATE POLICY "family_members_tenant_isolation" ON "family_members"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: family_wallets
ALTER TABLE "family_wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "family_wallets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_wallets_tenant_isolation" ON "family_wallets";
CREATE POLICY "family_wallets_tenant_isolation" ON "family_wallets"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: file_links
ALTER TABLE "file_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_links" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "file_links_tenant_isolation" ON "file_links";
CREATE POLICY "file_links_tenant_isolation" ON "file_links"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: files
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "files_tenant_isolation" ON "files";
CREATE POLICY "files_tenant_isolation" ON "files"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: financial_daily_aggregates
ALTER TABLE "financial_daily_aggregates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_daily_aggregates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_daily_aggregates_tenant_isolation" ON "financial_daily_aggregates";
CREATE POLICY "financial_daily_aggregates_tenant_isolation" ON "financial_daily_aggregates"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: gateway_transactions
ALTER TABLE "gateway_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gateway_transactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gateway_transactions_tenant_isolation" ON "gateway_transactions";
CREATE POLICY "gateway_transactions_tenant_isolation" ON "gateway_transactions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: generated_reports
ALTER TABLE "generated_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generated_reports" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "generated_reports_tenant_isolation" ON "generated_reports";
CREATE POLICY "generated_reports_tenant_isolation" ON "generated_reports"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: incoming_calls
ALTER TABLE "incoming_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incoming_calls" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "incoming_calls_tenant_isolation" ON "incoming_calls";
CREATE POLICY "incoming_calls_tenant_isolation" ON "incoming_calls"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: integration_logs
ALTER TABLE "integration_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integration_logs_tenant_isolation" ON "integration_logs";
CREATE POLICY "integration_logs_tenant_isolation" ON "integration_logs"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: integration_metrics
ALTER TABLE "integration_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integration_metrics_tenant_isolation" ON "integration_metrics";
CREATE POLICY "integration_metrics_tenant_isolation" ON "integration_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: integration_providers
ALTER TABLE "integration_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_providers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integration_providers_tenant_isolation" ON "integration_providers";
CREATE POLICY "integration_providers_tenant_isolation" ON "integration_providers"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: inventory_audits
ALTER TABLE "inventory_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_audits" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_audits_tenant_isolation" ON "inventory_audits";
CREATE POLICY "inventory_audits_tenant_isolation" ON "inventory_audits"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: inventory_balances
ALTER TABLE "inventory_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_balances" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_balances_tenant_isolation" ON "inventory_balances";
CREATE POLICY "inventory_balances_tenant_isolation" ON "inventory_balances"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: inventory_batches
ALTER TABLE "inventory_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_batches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_batches_tenant_isolation" ON "inventory_batches";
CREATE POLICY "inventory_batches_tenant_isolation" ON "inventory_batches"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: inventory_categories
ALTER TABLE "inventory_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_categories" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_categories_tenant_isolation" ON "inventory_categories";
CREATE POLICY "inventory_categories_tenant_isolation" ON "inventory_categories"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: inventory_consumptions
ALTER TABLE "inventory_consumptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_consumptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_consumptions_tenant_isolation" ON "inventory_consumptions";
CREATE POLICY "inventory_consumptions_tenant_isolation" ON "inventory_consumptions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: inventory_items
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_items_tenant_isolation" ON "inventory_items";
CREATE POLICY "inventory_items_tenant_isolation" ON "inventory_items"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: inventory_transactions
ALTER TABLE "inventory_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_transactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_transactions_tenant_isolation" ON "inventory_transactions";
CREATE POLICY "inventory_transactions_tenant_isolation" ON "inventory_transactions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: inventory_transfers
ALTER TABLE "inventory_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_transfers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_transfers_tenant_isolation" ON "inventory_transfers";
CREATE POLICY "inventory_transfers_tenant_isolation" ON "inventory_transfers"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: invoice_items
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_items_tenant_isolation" ON "invoice_items";
CREATE POLICY "invoice_items_tenant_isolation" ON "invoice_items"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: invoices
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_tenant_isolation" ON "invoices";
CREATE POLICY "invoices_tenant_isolation" ON "invoices"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: lab_orders
ALTER TABLE "lab_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lab_orders_tenant_isolation" ON "lab_orders";
CREATE POLICY "lab_orders_tenant_isolation" ON "lab_orders"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: lab_results
ALTER TABLE "lab_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_results" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lab_results_tenant_isolation" ON "lab_results";
CREATE POLICY "lab_results_tenant_isolation" ON "lab_results"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: laboratory_providers
ALTER TABLE "laboratory_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "laboratory_providers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "laboratory_providers_tenant_isolation" ON "laboratory_providers";
CREATE POLICY "laboratory_providers_tenant_isolation" ON "laboratory_providers"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: legal_document_templates
ALTER TABLE "legal_document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_document_templates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "legal_document_templates_tenant_isolation" ON "legal_document_templates";
CREATE POLICY "legal_document_templates_tenant_isolation" ON "legal_document_templates"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: legal_document_types
ALTER TABLE "legal_document_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_document_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "legal_document_types_tenant_isolation" ON "legal_document_types";
CREATE POLICY "legal_document_types_tenant_isolation" ON "legal_document_types"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: marketing_funnel_metrics
ALTER TABLE "marketing_funnel_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_funnel_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_funnel_metrics_tenant_isolation" ON "marketing_funnel_metrics";
CREATE POLICY "marketing_funnel_metrics_tenant_isolation" ON "marketing_funnel_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: medical_devices
ALTER TABLE "medical_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_devices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medical_devices_tenant_isolation" ON "medical_devices";
CREATE POLICY "medical_devices_tenant_isolation" ON "medical_devices"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: medical_files
ALTER TABLE "medical_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_files" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medical_files_tenant_isolation" ON "medical_files";
CREATE POLICY "medical_files_tenant_isolation" ON "medical_files"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: medical_records
ALTER TABLE "medical_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_records" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medical_records_tenant_isolation" ON "medical_records";
CREATE POLICY "medical_records_tenant_isolation" ON "medical_records"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: message_attachments
ALTER TABLE "message_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_attachments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_attachments_tenant_isolation" ON "message_attachments";
CREATE POLICY "message_attachments_tenant_isolation" ON "message_attachments"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: message_templates
ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_templates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_templates_tenant_isolation" ON "message_templates";
CREATE POLICY "message_templates_tenant_isolation" ON "message_templates"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: messages
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_tenant_isolation" ON "messages";
CREATE POLICY "messages_tenant_isolation" ON "messages"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: no_show_metrics
ALTER TABLE "no_show_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "no_show_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no_show_metrics_tenant_isolation" ON "no_show_metrics";
CREATE POLICY "no_show_metrics_tenant_isolation" ON "no_show_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: notification_rules
ALTER TABLE "notification_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_rules_tenant_isolation" ON "notification_rules";
CREATE POLICY "notification_rules_tenant_isolation" ON "notification_rules"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: notifications_queue
ALTER TABLE "notifications_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications_queue" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_queue_tenant_isolation" ON "notifications_queue";
CREATE POLICY "notifications_queue_tenant_isolation" ON "notifications_queue"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: online_booking_tokens
ALTER TABLE "online_booking_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "online_booking_tokens" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "online_booking_tokens_tenant_isolation" ON "online_booking_tokens";
CREATE POLICY "online_booking_tokens_tenant_isolation" ON "online_booking_tokens"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_addresses
ALTER TABLE "patient_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_addresses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_addresses_tenant_isolation" ON "patient_addresses";
CREATE POLICY "patient_addresses_tenant_isolation" ON "patient_addresses"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_contacts
ALTER TABLE "patient_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_contacts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_contacts_tenant_isolation" ON "patient_contacts";
CREATE POLICY "patient_contacts_tenant_isolation" ON "patient_contacts"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_crm_metrics
ALTER TABLE "patient_crm_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_crm_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_crm_metrics_tenant_isolation" ON "patient_crm_metrics";
CREATE POLICY "patient_crm_metrics_tenant_isolation" ON "patient_crm_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_debts
ALTER TABLE "patient_debts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_debts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_debts_tenant_isolation" ON "patient_debts";
CREATE POLICY "patient_debts_tenant_isolation" ON "patient_debts"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_leads
ALTER TABLE "patient_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_leads" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_leads_tenant_isolation" ON "patient_leads";
CREATE POLICY "patient_leads_tenant_isolation" ON "patient_leads"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_legal_documents
ALTER TABLE "patient_legal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_legal_documents" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_legal_documents_tenant_isolation" ON "patient_legal_documents";
CREATE POLICY "patient_legal_documents_tenant_isolation" ON "patient_legal_documents"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_notes
ALTER TABLE "patient_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_notes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_notes_tenant_isolation" ON "patient_notes";
CREATE POLICY "patient_notes_tenant_isolation" ON "patient_notes"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_tags
ALTER TABLE "patient_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_tags_tenant_isolation" ON "patient_tags";
CREATE POLICY "patient_tags_tenant_isolation" ON "patient_tags"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_timeline_events
ALTER TABLE "patient_timeline_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_timeline_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_timeline_events_tenant_isolation" ON "patient_timeline_events";
CREATE POLICY "patient_timeline_events_tenant_isolation" ON "patient_timeline_events"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patient_wallets
ALTER TABLE "patient_wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_wallets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_wallets_tenant_isolation" ON "patient_wallets";
CREATE POLICY "patient_wallets_tenant_isolation" ON "patient_wallets"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: patients
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patients" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patients_tenant_isolation" ON "patients";
CREATE POLICY "patients_tenant_isolation" ON "patients"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: payment_allocations
ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_allocations_tenant_isolation" ON "payment_allocations";
CREATE POLICY "payment_allocations_tenant_isolation" ON "payment_allocations"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: payment_gateways
ALTER TABLE "payment_gateways" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_gateways" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_gateways_tenant_isolation" ON "payment_gateways";
CREATE POLICY "payment_gateways_tenant_isolation" ON "payment_gateways"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: payments
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_tenant_isolation" ON "payments";
CREATE POLICY "payments_tenant_isolation" ON "payments"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: payroll_calculations
ALTER TABLE "payroll_calculations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_calculations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_calculations_tenant_isolation" ON "payroll_calculations";
CREATE POLICY "payroll_calculations_tenant_isolation" ON "payroll_calculations"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: payroll_rules
ALTER TABLE "payroll_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_rules_tenant_isolation" ON "payroll_rules";
CREATE POLICY "payroll_rules_tenant_isolation" ON "payroll_rules"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: positions
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "positions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "positions_tenant_isolation" ON "positions";
CREATE POLICY "positions_tenant_isolation" ON "positions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: prescription_items
ALTER TABLE "prescription_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prescription_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prescription_items_tenant_isolation" ON "prescription_items";
CREATE POLICY "prescription_items_tenant_isolation" ON "prescription_items"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: prescriptions
ALTER TABLE "prescriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prescriptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prescriptions_tenant_isolation" ON "prescriptions";
CREATE POLICY "prescriptions_tenant_isolation" ON "prescriptions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: procedure_orders
ALTER TABLE "procedure_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "procedure_orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "procedure_orders_tenant_isolation" ON "procedure_orders";
CREATE POLICY "procedure_orders_tenant_isolation" ON "procedure_orders"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: purchase_orders
ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_orders_tenant_isolation" ON "purchase_orders";
CREATE POLICY "purchase_orders_tenant_isolation" ON "purchase_orders"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: realtime_metrics_cache
ALTER TABLE "realtime_metrics_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "realtime_metrics_cache" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "realtime_metrics_cache_tenant_isolation" ON "realtime_metrics_cache";
CREATE POLICY "realtime_metrics_cache_tenant_isolation" ON "realtime_metrics_cache"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: receptionist_dashboards_cache
ALTER TABLE "receptionist_dashboards_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receptionist_dashboards_cache" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receptionist_dashboards_cache_tenant_isolation" ON "receptionist_dashboards_cache";
CREATE POLICY "receptionist_dashboards_cache_tenant_isolation" ON "receptionist_dashboards_cache"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: refunds
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refunds_tenant_isolation" ON "refunds";
CREATE POLICY "refunds_tenant_isolation" ON "refunds"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: resource_buffers
ALTER TABLE "resource_buffers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_buffers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resource_buffers_tenant_isolation" ON "resource_buffers";
CREATE POLICY "resource_buffers_tenant_isolation" ON "resource_buffers"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: retention_metrics
ALTER TABLE "retention_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retention_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retention_metrics_tenant_isolation" ON "retention_metrics";
CREATE POLICY "retention_metrics_tenant_isolation" ON "retention_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: roles
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_tenant_isolation" ON "roles";
CREATE POLICY "roles_tenant_isolation" ON "roles"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: room_types
ALTER TABLE "room_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_types_tenant_isolation" ON "room_types";
CREATE POLICY "room_types_tenant_isolation" ON "room_types"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: room_utilization_metrics
ALTER TABLE "room_utilization_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_utilization_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_utilization_metrics_tenant_isolation" ON "room_utilization_metrics";
CREATE POLICY "room_utilization_metrics_tenant_isolation" ON "room_utilization_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: rooms
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rooms_tenant_isolation" ON "rooms";
CREATE POLICY "rooms_tenant_isolation" ON "rooms"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: schedule_exceptions
ALTER TABLE "schedule_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedule_exceptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedule_exceptions_tenant_isolation" ON "schedule_exceptions";
CREATE POLICY "schedule_exceptions_tenant_isolation" ON "schedule_exceptions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: scheduled_reports
ALTER TABLE "scheduled_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_reports" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_reports_tenant_isolation" ON "scheduled_reports";
CREATE POLICY "scheduled_reports_tenant_isolation" ON "scheduled_reports"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: service_bom_templates
ALTER TABLE "service_bom_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_bom_templates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_bom_templates_tenant_isolation" ON "service_bom_templates";
CREATE POLICY "service_bom_templates_tenant_isolation" ON "service_bom_templates"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: service_required_resources
ALTER TABLE "service_required_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_required_resources" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_required_resources_tenant_isolation" ON "service_required_resources";
CREATE POLICY "service_required_resources_tenant_isolation" ON "service_required_resources"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: services
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_tenant_isolation" ON "services";
CREATE POLICY "services_tenant_isolation" ON "services"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: sms_providers
ALTER TABLE "sms_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_providers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_providers_tenant_isolation" ON "sms_providers";
CREATE POLICY "sms_providers_tenant_isolation" ON "sms_providers"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: stock_alert_rules
ALTER TABLE "stock_alert_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_alert_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_alert_rules_tenant_isolation" ON "stock_alert_rules";
CREATE POLICY "stock_alert_rules_tenant_isolation" ON "stock_alert_rules"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: stock_alerts
ALTER TABLE "stock_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_alerts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_alerts_tenant_isolation" ON "stock_alerts";
CREATE POLICY "stock_alerts_tenant_isolation" ON "stock_alerts"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: storage_providers
ALTER TABLE "storage_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storage_providers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "storage_providers_tenant_isolation" ON "storage_providers";
CREATE POLICY "storage_providers_tenant_isolation" ON "storage_providers"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: suppliers
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_tenant_isolation" ON "suppliers";
CREATE POLICY "suppliers_tenant_isolation" ON "suppliers"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: telephony_providers
ALTER TABLE "telephony_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "telephony_providers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "telephony_providers_tenant_isolation" ON "telephony_providers";
CREATE POLICY "telephony_providers_tenant_isolation" ON "telephony_providers"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: tenant_modules
ALTER TABLE "tenant_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_modules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_modules_tenant_isolation" ON "tenant_modules";
CREATE POLICY "tenant_modules_tenant_isolation" ON "tenant_modules"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: tenant_subscriptions
ALTER TABLE "tenant_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_subscriptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_subscriptions_tenant_isolation" ON "tenant_subscriptions";
CREATE POLICY "tenant_subscriptions_tenant_isolation" ON "tenant_subscriptions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: tenant_usage_metrics
ALTER TABLE "tenant_usage_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_usage_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_usage_metrics_tenant_isolation" ON "tenant_usage_metrics";
CREATE POLICY "tenant_usage_metrics_tenant_isolation" ON "tenant_usage_metrics"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: user_branch_roles
ALTER TABLE "user_branch_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_branch_roles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_branch_roles_tenant_isolation" ON "user_branch_roles";
CREATE POLICY "user_branch_roles_tenant_isolation" ON "user_branch_roles"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: user_sessions
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_sessions_tenant_isolation" ON "user_sessions";
CREATE POLICY "user_sessions_tenant_isolation" ON "user_sessions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_tenant_isolation" ON "users";
CREATE POLICY "users_tenant_isolation" ON "users"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: visit_queue
ALTER TABLE "visit_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visit_queue" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visit_queue_tenant_isolation" ON "visit_queue";
CREATE POLICY "visit_queue_tenant_isolation" ON "visit_queue"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: waiting_lists
ALTER TABLE "waiting_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waiting_lists" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waiting_lists_tenant_isolation" ON "waiting_lists";
CREATE POLICY "waiting_lists_tenant_isolation" ON "waiting_lists"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: wallet_transactions
ALTER TABLE "wallet_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_transactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_transactions_tenant_isolation" ON "wallet_transactions";
CREATE POLICY "wallet_transactions_tenant_isolation" ON "wallet_transactions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: warehouses
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouses_tenant_isolation" ON "warehouses";
CREATE POLICY "warehouses_tenant_isolation" ON "warehouses"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: webhook_events
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_events_tenant_isolation" ON "webhook_events";
CREATE POLICY "webhook_events_tenant_isolation" ON "webhook_events"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Table: working_schedules
ALTER TABLE "working_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "working_schedules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "working_schedules_tenant_isolation" ON "working_schedules";
CREATE POLICY "working_schedules_tenant_isolation" ON "working_schedules"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
