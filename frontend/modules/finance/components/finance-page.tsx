'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarClock,
  CreditCard,
  FileText,
  Landmark,
  Lock,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Undo2,
  WalletCards,
  X
} from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { can } from '@/shared/permissions/can';
import { usePatients } from '@/modules/patient-crm/hooks/use-patients';
import { useDoctors } from '@/modules/smart-scheduling/hooks/use-scheduling';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { useToast } from '@/shared/ui/toast';
import {
  FinanceInvoice,
  PaymentMethod,
  PayrollType,
  WalletType,
  useCloseShift,
  useCreatePayment,
  useCreatePayrollRule,
  useCreateRefund,
  useFinanceInvoices,
  useFinancePayments,
  useFinanceSummary,
  useOpenShift,
  usePatientWallet,
  usePayrollRules,
  useTopUpWallet
} from '../hooks/use-finance';

const paymentMethods: Array<{ value: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { value: 'CASH', label: 'Наличные', icon: Banknote },
  { value: 'CARD', label: 'Карта', icon: CreditCard },
  { value: 'QR', label: 'QR', icon: ReceiptText },
  { value: 'BANK_TRANSFER', label: 'Перевод', icon: Landmark },
  { value: 'WALLET', label: 'Кошелек', icon: WalletCards }
];

const invoiceStatuses = [
  { value: '', label: 'Все' },
  { value: 'PENDING_PAYMENT', label: 'Ожидают оплаты' },
  { value: 'PARTIALLY_PAID', label: 'Частично' },
  { value: 'PAID', label: 'Оплачены' },
  { value: 'REFUNDED', label: 'Возвраты' },
  { value: 'CANCELLED', label: 'Отменены' }
];

const payrollTypes: Array<{ value: PayrollType; label: string }> = [
  { value: 'REVENUE_SHARE', label: 'Процент от выручки' },
  { value: 'FIXED', label: 'Фикса' },
  { value: 'HYBRID', label: 'Фикса + процент' },
  { value: 'KPI_BASED', label: 'KPI' }
];

function amount(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function money(value: string | number | null | undefined, currency = 'TJS') {
  return `${amount(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency}`;
}

function dateTime(value?: string | null) {
  if (!value) return 'Нет данных';
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function dateOnly(value?: string | null) {
  if (!value) return 'Не задано';
  return new Date(value).toLocaleDateString('ru-RU');
}

function patientName(patient?: { firstName: string; lastName: string; middleName?: string | null }) {
  if (!patient) return 'Пациент';
  return [patient.lastName, patient.firstName, patient.middleName].filter(Boolean).join(' ');
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function statusMeta(status: string) {
  const map: Record<string, { label: string; tone: string }> = {
    DRAFT: { label: 'Черновик', tone: 'neutral' },
    PENDING_PAYMENT: { label: 'К оплате', tone: 'warning' },
    PARTIALLY_PAID: { label: 'Частично', tone: 'info' },
    PAID: { label: 'Оплачен', tone: 'success' },
    REFUNDED: { label: 'Возврат', tone: 'danger' },
    CANCELLED: { label: 'Отменен', tone: 'neutral' }
  };
  return map[status] ?? { label: status, tone: 'neutral' };
}

function canPay(invoice: FinanceInvoice) {
  return ['DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID'].includes(invoice.status) && amount(invoice.dueAmount) > 0;
}

export function FinancePage({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [drawer, setDrawer] = useState<'shift' | 'payment' | 'refund' | 'wallet' | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<FinanceInvoice | null>(null);

  const [openingBalance, setOpeningBalance] = useState('500');
  const [closingBalance, setClosingBalance] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('DEPOSIT');
  const [payrollEmployeeId, setPayrollEmployeeId] = useState('');
  const [payrollType, setPayrollType] = useState<PayrollType>('REVENUE_SHARE');
  const [percentageRate, setPercentageRate] = useState('35');
  const [fixedAmount, setFixedAmount] = useState('0');
  const [deductMaterialCost, setDeductMaterialCost] = useState(true);

  const { toast } = useToast();
  const branchId = bootstrap.branches[0]?.id;
  const canManageShift = can(bootstrap, 'finance.shift.manage');
  const canCreatePayment = can(bootstrap, 'finance.payment.create');
  const canRefund = can(bootstrap, 'finance.refund.manage');
  const canPayroll = can(bootstrap, 'finance.payroll.manage');

  const summary = useFinanceSummary();
  const invoices = useFinanceInvoices({ patientId: patientId || undefined, status: status || undefined, paymentMethod: method || undefined });
  const payments = useFinancePayments();
  const patients = usePatients(patientSearch);
  const selectedWallet = usePatientWallet(patientId || undefined);
  const doctors = useDoctors();
  const payrollRules = usePayrollRules(canPayroll);
  const openShift = useOpenShift();
  const closeShift = useCloseShift();
  const createPayment = useCreatePayment();
  const createRefund = useCreateRefund();
  const topUpWallet = useTopUpWallet();
  const createPayrollRule = useCreatePayrollRule();

  const activeShift = summary.data?.activeShift ?? null;
  const paymentLocked = !activeShift || !canCreatePayment;

  const totals = summary.data?.today;
  const selectedPatient = patients.data?.items.find((patient) => patient.id === patientId);
  const cashChange = useMemo(() => Math.max(amount(cashReceived) - amount(paymentAmount), 0), [cashReceived, paymentAmount]);

  const openPaymentDrawer = (invoice: FinanceInvoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(String(amount(invoice.dueAmount)));
    setCashReceived('');
    setPaymentMethod('CASH');
    setDrawer('payment');
  };

  const openRefundDrawer = (invoice: FinanceInvoice) => {
    setSelectedInvoice(invoice);
    const firstPayment = invoice.payments[0];
    setRefundPaymentId(firstPayment?.id ?? '');
    setRefundAmount(firstPayment ? String(amount(firstPayment.amount)) : String(amount(invoice.paidAmount)));
    setRefundReason('');
    setDrawer('refund');
  };

  const handleOpenShift = (event: FormEvent) => {
    event.preventDefault();
    if (!branchId) return;
    openShift.mutate(
      { branchId, openingBalance: amount(openingBalance) },
      {
        onSuccess: () => {
          toast('success', 'Смена открыта', 'Платежные операции разблокированы');
          setDrawer(null);
        },
        onError: (error) => toast('error', 'Не удалось открыть смену', error.message)
      }
    );
  };

  const handleCloseShift = (event: FormEvent) => {
    event.preventDefault();
    if (!activeShift) return;
    closeShift.mutate(
      { shiftId: activeShift.id, closingBalance: amount(closingBalance) },
      {
        onSuccess: () => {
          toast('success', 'Смена закрыта', 'Кассовый остаток зафиксирован');
          setClosingBalance('');
        },
        onError: (error) => toast('error', 'Не удалось закрыть смену', error.message)
      }
    );
  };

  const handlePayment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedInvoice) return;
    createPayment.mutate(
      {
        invoiceId: selectedInvoice.id,
        paymentMethod,
        amount: amount(paymentAmount),
        currency: selectedInvoice.currency
      },
      {
        onSuccess: () => {
          getRealtimeSocket().emit('finance.payment.completed', { invoiceId: selectedInvoice.id, patientId: selectedInvoice.patientId });
          toast('success', 'Оплата проведена', selectedInvoice.invoiceNumber);
          setDrawer(null);
        },
        onError: (error) => toast('error', 'Платеж отклонен', error.message)
      }
    );
  };

  const handleRefund = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedInvoice || !refundPaymentId) return;
    createRefund.mutate(
      {
        invoiceId: selectedInvoice.id,
        paymentId: refundPaymentId,
        refundAmount: amount(refundAmount),
        refundMethod: paymentMethod,
        reason: refundReason
      },
      {
        onSuccess: () => {
          toast('success', 'Возврат оформлен', 'Запись передана в аудит');
          setDrawer(null);
        },
        onError: (error) => toast('error', 'Возврат не выполнен', error.message)
      }
    );
  };

  const handleWalletTopUp = (event: FormEvent) => {
    event.preventDefault();
    if (!patientId) {
      toast('warning', 'Выберите пациента', 'Пополнение кошелька привязано к карточке пациента');
      return;
    }
    topUpWallet.mutate(
      { patientId, walletType, amount: amount(walletAmount), currency: 'TJS' },
      {
        onSuccess: () => {
          toast('success', 'Кошелек пополнен', selectedPatient?.fullName);
          setWalletAmount('');
          setDrawer(null);
        },
        onError: (error) => toast('error', 'Пополнение не выполнено', error.message)
      }
    );
  };

  const handlePayrollRule = (event: FormEvent) => {
    event.preventDefault();
    if (!payrollEmployeeId) return;
    createPayrollRule.mutate(
      {
        employeeId: payrollEmployeeId,
        payrollType,
        percentageRate: amount(percentageRate),
        fixedAmount: amount(fixedAmount),
        deductMaterialCost,
        appliesFrom: new Date().toISOString().slice(0, 10),
        appliesTo: null
      },
      {
        onSuccess: () => toast('success', 'Правило сохранено', 'Payroll конфигурация обновлена'),
        onError: (error) => toast('error', 'Правило не сохранено', error.message)
      }
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Финансовый контур</span>
          <h1>Финансы</h1>
          <p>Кассовые смены, счета, оплаты, возвраты, авансовые кошельки пациентов и правила вознаграждений врачей.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-button" onClick={() => summary.refetch()} type="button">
            <RefreshCw size={17} />
            Обновить
          </button>
          {canManageShift && !activeShift ? (
            <button className="button" onClick={() => setDrawer('shift')} type="button">
              <Plus size={17} />
              Открыть смену
            </button>
          ) : null}
        </div>
      </div>

      <section className="finance-status-strip">
        <div className={`finance-shift-card ${activeShift ? 'is-open' : 'is-locked'}`}>
          <span className="finance-shift-icon">{activeShift ? <ShieldCheck size={19} /> : <Lock size={19} />}</span>
          <div>
            <strong>{activeShift ? 'Кассовая смена открыта' : 'Кассовая смена закрыта'}</strong>
            <span>{activeShift ? `Открыта ${dateTime(activeShift.openedAt)} · остаток ${money(activeShift.openingBalance)}` : 'Платежи, возвраты и пополнения заблокированы'}</span>
          </div>
        </div>
        <div className="finance-guardrail">
          <span>RBAC</span>
          <strong>{canPayroll ? 'Руководитель' : 'Администратор кассы'}</strong>
          <small>tenant scope · request tracing · audit logging</small>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="metric-card">
          <span>Оплачено сегодня</span>
          <strong>{money(totals?.paidAmount ?? 0)}</strong>
          <small>{totals?.paidCount ?? 0} платежей</small>
        </article>
        <article className="metric-card">
          <span>Счета сегодня</span>
          <strong>{totals?.invoicesCount ?? 0}</strong>
          <small>{money(totals?.invoicesTotal ?? 0)}</small>
        </article>
        <article className="metric-card">
          <span>Ожидают оплаты</span>
          <strong>{totals?.pendingCount ?? 0}</strong>
          <small>{money(totals?.pendingDueAmount ?? 0)}</small>
        </article>
        <article className="metric-card">
          <span>Возвраты</span>
          <strong>{money(totals?.refundedAmount ?? 0)}</strong>
          <small>{totals?.refundsCount ?? 0} операций</small>
        </article>
        <article className="metric-card">
          <span>Полностью оплачены</span>
          <strong>{totals?.fullyPaidInvoicesCount ?? 0}</strong>
          <small>за текущий день</small>
        </article>
        <article className="metric-card">
          <span>Тариф клиники</span>
          <strong>{summary.data?.subscription?.subscriptionPlan?.name ?? bootstrap.tenant.subscriptionPlan}</strong>
          <small>{summary.data?.subscription?.subscriptionStatus ?? 'active'}</small>
        </article>
      </section>

      <div className="finance-layout section-gap">
        <section className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Счета и платежи</h2>
              <p className="muted">Фильтрация по пациенту, статусу счета и способу оплаты.</p>
            </div>
            <span className="status-badge status-info">{invoices.data?.total ?? 0} счетов</span>
          </div>

          <div className="finance-filter-grid">
            <label className="global-search search">
              <Search size={18} />
              <input placeholder="Поиск пациента" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} />
            </label>
            <select className="input" value={patientId} onChange={(event) => setPatientId(event.target.value)}>
              <option value="">Все пациенты</option>
              {patients.data?.items.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName} · {patient.patientCode}
                </option>
              ))}
            </select>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
              {invoiceStatuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select className="input" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="">Все методы</option>
              {paymentMethods.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {invoices.isLoading ? <p className="muted">Загрузка счетов...</p> : null}
          {invoices.error ? <p className="error">Не удалось загрузить счета</p> : null}

          {invoices.data?.items.length ? (
            <div className="data-surface finance-table-wrap">
              <table className="data-table finance-table">
                <thead>
                  <tr>
                    <th>Счет</th>
                    <th>Пациент</th>
                    <th>Сумма</th>
                    <th>Оплачено</th>
                    <th>Долг</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.data.items.map((invoice) => {
                    const meta = statusMeta(invoice.status);
                    return (
                      <tr key={invoice.id}>
                        <td>
                          <strong>{invoice.invoiceNumber}</strong>
                          <span className="table-subtext">{dateOnly(invoice.invoiceDate)}</span>
                        </td>
                        <td>
                          <div className="person-cell compact-person">
                            <span className="avatar">{initials(patientName(invoice.patient))}</span>
                            <span>
                              <strong>{patientName(invoice.patient)}</strong>
                              <span>{invoice.patient.patientCode}</span>
                            </span>
                          </div>
                        </td>
                        <td>{money(invoice.totalAmount, invoice.currency)}</td>
                        <td>{money(invoice.paidAmount, invoice.currency)}</td>
                        <td className={amount(invoice.dueAmount) > 0 ? 'warn' : undefined}>{money(invoice.dueAmount, invoice.currency)}</td>
                        <td><span className={`status-badge status-${meta.tone}`}>{meta.label}</span></td>
                        <td>
                          <div className="badges">
                            <button className="secondary-button compact-button" disabled={paymentLocked || !canPay(invoice)} onClick={() => openPaymentDrawer(invoice)} type="button">
                              <CreditCard size={15} />
                              Оплата
                            </button>
                            <button className="secondary-button compact-button" disabled={!activeShift || !canRefund || !invoice.payments.length} onClick={() => openRefundDrawer(invoice)} type="button">
                              <Undo2 size={15} />
                              Возврат
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : !invoices.isLoading ? (
            <div className="empty-state">
              <div>
                <strong>Счета не найдены</strong>
                <span>Измените фильтры или проверьте демо-данные финансового модуля.</span>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="side-stack">
          <section className="content-panel">
            <div className="panel-header">
              <div>
                <h3>Кассовая смена</h3>
                <p className="muted">Открытие и закрытие смены администратора.</p>
              </div>
              <CalendarClock size={18} className="muted" />
            </div>
            {activeShift ? (
              <form className="form" onSubmit={handleCloseShift}>
                <div className="compact-stat">
                  <span>Открыта</span>
                  <strong>{dateTime(activeShift.openedAt)}</strong>
                </div>
                <div className="compact-stat">
                  <span>Начальный остаток</span>
                  <strong>{money(activeShift.openingBalance)}</strong>
                </div>
                <div className="field">
                  <label htmlFor="closingBalance">Фактический остаток</label>
                  <input id="closingBalance" inputMode="decimal" value={closingBalance} onChange={(event) => setClosingBalance(event.target.value)} placeholder="Например, 1850" required />
                </div>
                <button className="secondary-button" disabled={closeShift.isPending || !canManageShift} type="submit">Закрыть смену</button>
              </form>
            ) : (
              <div className="list">
                <p className="muted">Откройте смену, чтобы проводить оплаты, возвраты и пополнения кошельков.</p>
                <button className="button" disabled={!canManageShift} onClick={() => setDrawer('shift')} type="button">
                  <Plus size={17} />
                  Открыть смену
                </button>
              </div>
            )}
          </section>

          <section className="content-panel">
            <div className="panel-header">
              <div>
                <h3>Кошелек пациента</h3>
                <p className="muted">Депозит, бонусы и кредитный лимит по выбранной карточке.</p>
              </div>
              <WalletCards size={18} className="muted" />
            </div>
            {patientId ? (
              <div className="list">
                {selectedWallet.data?.map((wallet) => (
                  <div className="row finance-wallet-row" key={wallet.id}>
                    <span className="status-badge status-info">{wallet.walletType}</span>
                    <strong>{money(wallet.balance, wallet.currency)}</strong>
                    <small className="muted">Обновлен {dateTime(wallet.updatedAt)}</small>
                  </div>
                ))}
                {!selectedWallet.data?.length && !selectedWallet.isLoading ? <p className="muted">Кошельки еще не созданы.</p> : null}
                <button className="secondary-button" disabled={paymentLocked} onClick={() => setDrawer('wallet')} type="button">
                  <Plus size={17} />
                  Пополнить
                </button>
              </div>
            ) : (
              <p className="muted">Выберите пациента в фильтрах счетов, чтобы увидеть баланс кошелька.</p>
            )}
          </section>

          <section className="content-panel">
            <div className="panel-header">
              <div>
                <h3>Последние платежи</h3>
                <p className="muted">Аудиторский след кассовых операций.</p>
              </div>
              <FileText size={18} className="muted" />
            </div>
            <div className="list">
              {payments.data?.items.slice(0, 5).map((payment) => (
                <div className="row" key={payment.id}>
                  <div className="compact-stat">
                    <span>{payment.invoice?.invoiceNumber ?? 'Счет'}</span>
                    <strong>{money(payment.amount, payment.currency)}</strong>
                  </div>
                  <small className="muted">{patientName(payment.patient)} · {payment.paymentMethod} · {dateTime(payment.paidAt)}</small>
                </div>
              ))}
              {!payments.data?.items.length && !payments.isLoading ? <p className="muted">Платежей пока нет.</p> : null}
            </div>
          </section>
        </aside>
      </div>

      {canPayroll ? (
        <section className="content-panel section-gap">
          <div className="panel-header">
            <div>
              <h2>Payroll & Billing</h2>
              <p className="muted">Правила расчета вознаграждений врачей и контроль SaaS-подписки клиники.</p>
            </div>
            <span className="status-badge status-violet">Доступ руководителя</span>
          </div>
          <div className="finance-payroll-grid">
            <form className="form" onSubmit={handlePayrollRule}>
              <div className="field">
                <label htmlFor="payrollEmployee">Врач</label>
                <select id="payrollEmployee" value={payrollEmployeeId} onChange={(event) => setPayrollEmployeeId(event.target.value)} required>
                  <option value="">Выберите сотрудника</option>
                  {doctors.data?.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.branchName}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="payrollType">Тип правила</label>
                <select id="payrollType" value={payrollType} onChange={(event) => setPayrollType(event.target.value as PayrollType)}>
                  {payrollTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="finance-form-pair">
                <div className="field">
                  <label htmlFor="percentageRate">Процент</label>
                  <input id="percentageRate" inputMode="decimal" value={percentageRate} onChange={(event) => setPercentageRate(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="fixedAmount">Фикса</label>
                  <input id="fixedAmount" inputMode="decimal" value={fixedAmount} onChange={(event) => setFixedAmount(event.target.value)} />
                </div>
              </div>
              <label className="finance-check">
                <input checked={deductMaterialCost} onChange={(event) => setDeductMaterialCost(event.target.checked)} type="checkbox" />
                Вычитать себестоимость материалов
              </label>
              <button className="button" disabled={createPayrollRule.isPending} type="submit">Сохранить правило</button>
            </form>

            <div className="list">
              {payrollRules.data?.items.map((rule) => (
                <div className="row finance-rule-row" key={rule.id}>
                  <div>
                    <strong>{patientName(rule.employee)}</strong>
                    <span className="table-subtext">{rule.employee?.employeeNumber}</span>
                  </div>
                  <span className={`status-badge ${rule.isActive ? 'status-success' : 'status-neutral'}`}>{rule.payrollType}</span>
                  <div className="compact-stat">
                    <span>Процент / фикса</span>
                    <strong>{amount(rule.percentageRate)}% · {money(rule.fixedAmount)}</strong>
                  </div>
                  <small className="muted">Действует с {dateOnly(rule.appliesFrom)}</small>
                </div>
              ))}
              {!payrollRules.data?.items.length && !payrollRules.isLoading ? <p className="muted">Правила payroll еще не настроены.</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {drawer ? (
        <>
          <div className="slide-over-backdrop" onClick={() => setDrawer(null)} />
          <aside className="slide-over finance-drawer">
            <div className="slide-over-header">
              <h2>
                {drawer === 'shift' ? 'Открытие смены' : null}
                {drawer === 'payment' ? 'Оплата счета' : null}
                {drawer === 'refund' ? 'Возврат платежа' : null}
                {drawer === 'wallet' ? 'Пополнение кошелька' : null}
              </h2>
              <button className="icon-button" onClick={() => setDrawer(null)} type="button" aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>

            {drawer === 'shift' ? (
              <form className="form" onSubmit={handleOpenShift}>
                <p className="muted">Фискальные операции будут доступны только после открытия смены.</p>
                <div className="field">
                  <label htmlFor="openingBalance">Разменный остаток</label>
                  <input id="openingBalance" inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} required />
                </div>
                <button className="button" disabled={openShift.isPending || !canManageShift} type="submit">Открыть смену</button>
              </form>
            ) : null}

            {drawer === 'payment' && selectedInvoice ? (
              <form className="form" onSubmit={handlePayment}>
                <div className="finance-invoice-summary">
                  <strong>{selectedInvoice.invoiceNumber}</strong>
                  <span>{patientName(selectedInvoice.patient)}</span>
                  <b>{money(selectedInvoice.dueAmount, selectedInvoice.currency)}</b>
                </div>
                <div className="finance-method-grid">
                  {paymentMethods.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button className={paymentMethod === item.value ? 'active' : undefined} key={item.value} onClick={() => setPaymentMethod(item.value)} type="button">
                        <Icon size={17} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div className="field">
                  <label htmlFor="paymentAmount">Сумма оплаты</label>
                  <input id="paymentAmount" inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required />
                </div>
                {paymentMethod === 'CASH' ? (
                  <div className="finance-form-pair">
                    <div className="field">
                      <label htmlFor="cashReceived">Получено наличными</label>
                      <input id="cashReceived" inputMode="decimal" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} />
                    </div>
                    <div className="finance-change">
                      <span>Сдача</span>
                      <strong>{money(cashChange, selectedInvoice.currency)}</strong>
                    </div>
                  </div>
                ) : null}
                <button className="button" disabled={createPayment.isPending || paymentLocked} type="submit">Провести оплату</button>
              </form>
            ) : null}

            {drawer === 'refund' && selectedInvoice ? (
              <form className="form" onSubmit={handleRefund}>
                <p className="muted">Причина возврата обязательна для audit logging и последующей сверки смены.</p>
                <div className="field">
                  <label htmlFor="refundPayment">Платеж</label>
                  <select id="refundPayment" value={refundPaymentId} onChange={(event) => setRefundPaymentId(event.target.value)} required>
                    {selectedInvoice.payments.map((payment) => (
                      <option key={payment.id} value={payment.id}>{dateTime(payment.paidAt)} · {payment.paymentMethod} · {money(payment.amount, payment.currency)}</option>
                    ))}
                  </select>
                </div>
                <div className="finance-form-pair">
                  <div className="field">
                    <label htmlFor="refundAmount">Сумма возврата</label>
                    <input id="refundAmount" inputMode="decimal" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} required />
                  </div>
                  <div className="field">
                    <label htmlFor="refundMethod">Метод</label>
                    <select id="refundMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                      {paymentMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="refundReason">Причина</label>
                  <textarea id="refundReason" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} rows={4} required />
                </div>
                <button className="button danger-button" disabled={createRefund.isPending || !activeShift || !canRefund} type="submit">Оформить возврат</button>
              </form>
            ) : null}

            {drawer === 'wallet' ? (
              <form className="form" onSubmit={handleWalletTopUp}>
                <div className="finance-invoice-summary">
                  <strong>{selectedPatient?.fullName ?? 'Пациент не выбран'}</strong>
                  <span>{selectedPatient?.patientCode ?? 'Выберите пациента в фильтрах'}</span>
                </div>
                <div className="field">
                  <label htmlFor="walletType">Тип кошелька</label>
                  <select id="walletType" value={walletType} onChange={(event) => setWalletType(event.target.value as WalletType)}>
                    <option value="DEPOSIT">Депозит</option>
                    <option value="BONUS">Бонусы</option>
                    <option value="CREDIT">Кредит</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="walletAmount">Сумма пополнения</label>
                  <input id="walletAmount" inputMode="decimal" value={walletAmount} onChange={(event) => setWalletAmount(event.target.value)} required />
                </div>
                <button className="button" disabled={topUpWallet.isPending || paymentLocked || !patientId} type="submit">Пополнить кошелек</button>
              </form>
            ) : null}
          </aside>
        </>
      ) : null}
    </>
  );
}
