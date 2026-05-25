'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';

export type CashierShift = {
  id: string;
  branchId: string;
  cashierUserId: string;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: string | number;
  closingBalance?: string | number | null;
  discrepancyAmount?: string | number | null;
};

export type FinancePatient = {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
};

export type FinanceInvoiceItem = {
  id: string;
  service?: { id: string; name: string; code: string } | null;
  performer?: { id: string; firstName: string; lastName: string } | null;
  quantity: number;
  unitPrice: string | number;
  discountAmount: string | number;
  materialCost: string | number;
  totalAmount: string | number;
};

export type FinancePayment = {
  id: string;
  invoiceId: string;
  patientId: string;
  paymentMethod: PaymentMethod;
  paymentProvider?: string | null;
  amount: string | number;
  currency: string;
  status: string;
  paidAt: string;
  patient?: FinancePatient;
  invoice?: { id: string; invoiceNumber: string; status: string; totalAmount: string | number };
  refunds?: FinanceRefund[];
};

export type FinanceRefund = {
  id: string;
  invoiceId: string;
  paymentId: string;
  refundAmount: string | number;
  refundMethod: string;
  reason?: string | null;
  refundStatus: string;
  refundedAt: string;
};

export type FinanceInvoice = {
  id: string;
  branchId: string;
  patientId: string;
  appointmentId?: string | null;
  invoiceNumber: string;
  status: string;
  subtotalAmount: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  dueAmount: string | number;
  currency: string;
  invoiceDate: string;
  dueDate?: string | null;
  patient: FinancePatient;
  branch?: { id: string; name: string };
  appointment?: { id: string; appointmentNumber: string; startAt: string; status: string } | null;
  items: FinanceInvoiceItem[];
  payments: FinancePayment[];
  refunds: FinanceRefund[];
};

export type FinanceSummary = {
  activeShift: CashierShift | null;
  today: {
    invoicesCount: number;
    invoicesTotal: number;
    paidAmount: number;
    paidCount: number;
    refundedAmount: number;
    refundsCount: number;
    pendingCount: number;
    pendingDueAmount: number;
    fullyPaidInvoicesCount: number;
  };
  subscription?: {
    id: string;
    subscriptionStatus: string;
    startedAt: string;
    expiresAt: string;
    subscriptionPlan?: {
      code: string;
      name: string;
      monthlyPrice: string | number;
      yearlyPrice: string | number;
    };
  } | null;
};

export type PatientWallet = {
  id: string;
  patientId: string;
  walletType: WalletType;
  balance: string | number;
  currency: string;
  updatedAt: string;
};

export type PayrollRule = {
  id: string;
  employeeId: string;
  payrollType: PayrollType;
  percentageRate: string | number;
  fixedAmount: string | number;
  deductMaterialCost: boolean;
  appliesFrom: string;
  appliesTo?: string | null;
  isActive: boolean;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    employeeNumber: string;
  };
};

export type PaymentMethod = 'CASH' | 'CARD' | 'QR' | 'BANK_TRANSFER' | 'WALLET' | 'FAMILY_BALANCE' | 'ONLINE_GATEWAY';
export type WalletType = 'DEPOSIT' | 'BONUS' | 'CREDIT';
export type PayrollType = 'REVENUE_SHARE' | 'FIXED' | 'HYBRID' | 'KPI_BASED';

type ListResponse<T> = { items: T[]; total: number };

function invalidateFinance(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
  queryClient.invalidateQueries({ queryKey: ['finance-invoices'] });
  queryClient.invalidateQueries({ queryKey: ['finance-payments'] });
  queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: ['finance-summary'],
    queryFn: () => apiFetch<FinanceSummary>('/finance/summary')
  });
}

export function useFinanceInvoices(filters: { patientId?: string; status?: string; paymentMethod?: string }) {
  const params = new URLSearchParams();
  if (filters.patientId) params.set('patientId', filters.patientId);
  if (filters.status) params.set('status', filters.status);
  if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
  const queryString = params.toString();

  return useQuery({
    queryKey: ['finance-invoices', filters.patientId ?? '', filters.status ?? '', filters.paymentMethod ?? ''],
    queryFn: () => apiFetch<ListResponse<FinanceInvoice>>(`/finance/invoices${queryString ? `?${queryString}` : ''}`)
  });
}

export function useFinancePayments() {
  return useQuery({
    queryKey: ['finance-payments'],
    queryFn: () => apiFetch<ListResponse<FinancePayment>>('/finance/payments')
  });
}

export function useActiveShift() {
  return useQuery({
    queryKey: ['finance-active-shift'],
    queryFn: () => apiFetch<CashierShift | null>('/finance/shifts/active')
  });
}

export function useOpenShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { branchId: string; openingBalance: number }) =>
      apiFetch<CashierShift>('/finance/shifts/open', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    }
  });
}

export function useCloseShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, closingBalance }: { shiftId: string; closingBalance: number }) =>
      apiFetch<CashierShift>(`/finance/shifts/close/${shiftId}`, {
        method: 'POST',
        body: JSON.stringify({ closingBalance })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    }
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...input }: { invoiceId: string; paymentMethod: PaymentMethod; amount: number; currency: string; paymentProvider?: string; externalTransactionId?: string }) =>
      apiFetch<{ payment: FinancePayment; invoice: FinanceInvoice }>(`/finance/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify(input)
      }),
    onSuccess: () => invalidateFinance(queryClient)
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...input }: { invoiceId: string; paymentId: string; refundAmount: number; refundMethod: string; reason?: string }) =>
      apiFetch<{ refund: FinanceRefund; invoice: FinanceInvoice }>(`/finance/invoices/${invoiceId}/refunds`, {
        method: 'POST',
        body: JSON.stringify(input)
      }),
    onSuccess: () => invalidateFinance(queryClient)
  });
}

export function usePatientWallet(patientId?: string) {
  return useQuery({
    queryKey: ['finance-wallet', patientId ?? ''],
    queryFn: () => apiFetch<PatientWallet[]>(`/finance/wallets/patient/${patientId}`),
    enabled: Boolean(patientId)
  });
}

export function useTopUpWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { patientId: string; walletType: WalletType; amount: number; currency: string }) =>
      apiFetch<PatientWallet>('/finance/wallets/topup', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (_wallet, input) => {
      queryClient.invalidateQueries({ queryKey: ['finance-wallet', input.patientId] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    }
  });
}

export function usePayrollRules(enabled: boolean) {
  return useQuery({
    queryKey: ['finance-payroll-rules'],
    queryFn: () => apiFetch<ListResponse<PayrollRule>>('/finance/payroll/rules'),
    enabled
  });
}

export function useCreatePayrollRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { employeeId: string; payrollType: PayrollType; percentageRate: number; fixedAmount: number; deductMaterialCost: boolean; appliesFrom: string; appliesTo?: string | null }) =>
      apiFetch<PayrollRule>('/finance/payroll/rules', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-payroll-rules'] });
    }
  });
}
