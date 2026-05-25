import { z } from 'zod';

export const AnalyticsFilterSchema = z.object({
  branchId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  dateFrom: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  dateTo: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  metricCode: z.string().optional(),
  channelSource: z.string().optional(),
});

export type AnalyticsFilterDto = z.infer<typeof AnalyticsFilterSchema>;

export const CreateScheduledReportSchema = z.object({
  reportName: z.string().min(3).max(255),
  reportType: z.enum(['FINANCIAL', 'MARKETING', 'OPERATIONAL', 'DOCTOR_KPI']),
  exportFormat: z.enum(['PDF', 'XLSX', 'CSV']),
  recipientsJson: z.array(z.string().email()),
  cronExpression: z.string().min(5).max(80),
  filtersJson: z.record(z.any()).default({}),
});

export type CreateScheduledReportDto = z.infer<typeof CreateScheduledReportSchema>;

export const RecalculateMetricsSchema = z.object({
  syncAll: z.boolean().default(false),
});

export type RecalculateMetricsDto = z.infer<typeof RecalculateMetricsSchema>;
