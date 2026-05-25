export enum QueueNames {
  NOTIFICATIONS_DISPATCH = 'notifications.dispatch',
  NOTIFICATIONS_SCHEDULE_SCAN = 'notifications.schedule-scan',
  NOTIFICATIONS_SCHEDULE_SCAN_TRIGGER = 'notifications.schedule-scan.trigger',
  APPOINTMENTS_NO_SHOW = 'appointments.no-show',
  KPI_DAILY_AGGREGATE = 'kpi.daily-aggregate',
  KPI_DAILY_AGGREGATE_TRIGGER = 'kpi.daily-aggregate.trigger',
  KPI_HOURLY_AGGREGATE = 'kpi.hourly-aggregate',
  KPI_HOURLY_AGGREGATE_TRIGGER = 'kpi.hourly-aggregate.trigger',
  INTEGRATIONS_OUTBOX = 'integrations.outbox',
  INTEGRATIONS_OUTBOX_RELAY_TRIGGER = 'integrations.outbox.relay-trigger',
  AUDIT_CHECKPOINT = 'audit.checkpoint',
  MAINTENANCE_CLEANUP = 'maintenance.cleanup',
}
