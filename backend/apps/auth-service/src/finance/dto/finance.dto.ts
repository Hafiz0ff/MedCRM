import { z } from 'zod';

export const OpenShiftSchema = z.object({
  branchId: z.string().uuid(),
  openingBalance: z.number().min(0),
});
export type OpenShiftDto = z.infer<typeof OpenShiftSchema>;

export const CloseShiftSchema = z.object({
  closingBalance: z.number().min(0),
});
export type CloseShiftDto = z.infer<typeof CloseShiftSchema>;

export const CreatePaymentSchema = z.object({
  paymentMethod: z.enum([
    'CASH',
    'CARD',
    'QR',
    'BANK_TRANSFER',
    'WALLET',
    'FAMILY_BALANCE',
    'ONLINE_GATEWAY',
  ]),
  paymentProvider: z.string().max(80).optional().nullable(),
  amount: z.number().positive(),
  currency: z.string().max(10).default('TJS'),
  externalTransactionId: z.string().max(255).optional().nullable(),
});
export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;

export const CreateRefundSchema = z.object({
  paymentId: z.string().uuid(),
  refundAmount: z.number().positive(),
  refundMethod: z.string().max(40),
  reason: z.string().max(255).optional().nullable(),
});
export type CreateRefundDto = z.infer<typeof CreateRefundSchema>;

export const WalletTopUpSchema = z.object({
  patientId: z.string().uuid(),
  walletType: z.enum(['DEPOSIT', 'BONUS', 'CREDIT']),
  amount: z.number().positive(),
  currency: z.string().max(10).default('TJS'),
});
export type WalletTopUpDto = z.infer<typeof WalletTopUpSchema>;

export const CreatePayrollRuleSchema = z.object({
  employeeId: z.string().uuid(),
  payrollType: z.enum(['REVENUE_SHARE', 'FIXED', 'HYBRID', 'KPI_BASED']),
  percentageRate: z.number().min(0).max(100).optional().default(0),
  fixedAmount: z.number().min(0).optional().default(0),
  deductMaterialCost: z.boolean().optional().default(true),
  appliesFrom: z.string().date(),
  appliesTo: z.string().date().optional().nullable(),
});
export type CreatePayrollRuleDto = z.infer<typeof CreatePayrollRuleSchema>;

export const CalculatePayrollSchema = z.object({
  employeeId: z.string().uuid(),
  payrollPeriod: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
});
export type CalculatePayrollDto = z.infer<typeof CalculatePayrollSchema>;

export const CreateSubscriptionPlanSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(255),
  monthlyPrice: z.number().min(0),
  yearlyPrice: z.number().min(0),
  featuresJson: z.any().optional().default({}),
  limitsJson: z.any().optional().default({}),
});
export type CreateSubscriptionPlanDto = z.infer<typeof CreateSubscriptionPlanSchema>;
