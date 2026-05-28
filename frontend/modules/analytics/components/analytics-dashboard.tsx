'use client';

import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  DollarSign,
  LineChart as LineChartIcon,
  Loader2,
  PieChart as PieChartIcon,
  Percent,
  RefreshCw,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useAnalyticsDashboard,
  useAnalyticsKpi,
  useMetabaseToken,
  useTriggerEtl,
} from '../hooks/use-analytics';
import { useToast } from '@/shared/ui/toast';

type AnalyticsTab = 'overview' | 'finance' | 'ops' | 'marketing' | 'forecast' | 'metabase';

export function AnalyticsDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

  const kpiQuery = useAnalyticsKpi();
  const triggerEtl = useTriggerEtl();

  const handleTriggerEtl = () => {
    triggerEtl.mutate(undefined, {
      onSuccess: () => {
        toast(
          'success',
          'Аналитическая база успешно пересчитана',
          'Все данные DwFact актуализированы',
        );
        kpiQuery.refetch();
      },
      onError: (err) => {
        toast('error', 'Не удалось пересчитать базу', err.message);
      },
    });
  };

  if (kpiQuery.isLoading) {
    return (
      <div className="settings-loading" style={{ minHeight: '60vh' }}>
        <Loader2 className="spin" size={24} />
        <span>Загружаем аналитические модули…</span>
      </div>
    );
  }

  const kpi = kpiQuery.data;

  return (
    <div className="analytics-dashboard" style={{ padding: '20px 0' }}>
      {/* KPI Stats Grid */}
      <div
        className="settings-grid-four"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        <div className="content-panel kpi-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              className="muted"
              style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
            >
              Выручка за 30 дней
            </span>
            <DollarSign size={18} className="muted" style={{ color: 'var(--brand)' }} />
          </div>
          <strong style={{ display: 'block', fontSize: '24px', marginTop: '10px' }}>
            {kpi?.last30DaysRevenue.toLocaleString('ru-RU')} ₽
          </strong>
          <span className="muted" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
            На основе оплаченных счетов
          </span>
        </div>

        <div className="content-panel kpi-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              className="muted"
              style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
            >
              Сегодняшняя касса
            </span>
            <TrendingUp size={18} className="muted" style={{ color: 'var(--blue)' }} />
          </div>
          <strong style={{ display: 'block', fontSize: '24px', marginTop: '10px' }}>
            {kpi?.todayRevenue.toLocaleString('ru-RU')} ₽
          </strong>
          <span className="muted" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
            Вчера и сегодня
          </span>
        </div>

        <div className="content-panel kpi-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              className="muted"
              style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
            >
              Средний чек
            </span>
            <Award size={18} className="muted" style={{ color: 'var(--amber)' }} />
          </div>
          <strong style={{ display: 'block', fontSize: '24px', marginTop: '10px' }}>
            {Math.round(kpi?.averageCheck ?? 0).toLocaleString('ru-RU')} ₽
          </strong>
          <span className="muted" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
            По среднему значению
          </span>
        </div>

        <div className="content-panel kpi-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              className="muted"
              style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
            >
              Живая очередь
            </span>
            <Users size={18} className="muted" style={{ color: 'var(--red)' }} />
          </div>
          <strong style={{ display: 'block', fontSize: '24px', marginTop: '10px' }}>
            {kpi?.activeQueue} человек
          </strong>
          <span className="muted" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
            Ожидают в холле
          </span>
        </div>
      </div>

      {/* Tabs navigation */}
      <section className="content-panel">
        <div className="panel-header" style={{ borderBottom: '1px solid var(--line)' }}>
          <div>
            <h2>
              <Activity size={18} /> Аналитическая панель MedCRM
            </h2>
            <p className="muted">
              Визуализация операционных, клинических и финансовых результатов клиники.
            </p>
          </div>
          <div className="page-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleTriggerEtl}
              disabled={triggerEtl.isPending}
            >
              <RefreshCw size={14} className={triggerEtl.isPending ? 'spin' : ''} />
              <span>{triggerEtl.isPending ? 'Расчёт...' : 'Пересчитать базу'}</span>
            </button>
          </div>
        </div>

        <nav className="settings-tabs" role="tablist" aria-label="Категории аналитики">
          <button
            type="button"
            className={`settings-tab${activeTab === 'overview' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <TrendingUp size={16} />
            <span>Обзор</span>
          </button>
          <button
            type="button"
            className={`settings-tab${activeTab === 'finance' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('finance')}
          >
            <DollarSign size={16} />
            <span>Финансы</span>
          </button>
          <button
            type="button"
            className={`settings-tab${activeTab === 'ops' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('ops')}
          >
            <Percent size={16} />
            <span>Клиника и Врачи</span>
          </button>
          <button
            type="button"
            className={`settings-tab${activeTab === 'marketing' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('marketing')}
          >
            <Users size={16} />
            <span>Маркетинг</span>
          </button>
          <button
            type="button"
            className={`settings-tab${activeTab === 'forecast' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('forecast')}
          >
            <Calendar size={16} />
            <span>Прогнозы ML</span>
          </button>
          <button
            type="button"
            className={`settings-tab${activeTab === 'metabase' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('metabase')}
          >
            <Warehouse size={16} />
            <span>Self-Service BI</span>
          </button>
        </nav>

        <div className="settings-tab-panel" style={{ padding: '24px' }}>
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'finance' && <FinanceTab />}
          {activeTab === 'ops' && <OperationsTab />}
          {activeTab === 'marketing' && <MarketingTab />}
          {activeTab === 'forecast' && <ForecastTab />}
          {activeTab === 'metabase' && <MetabaseTab />}
        </div>
      </section>
    </div>
  );
}

// ======================== TABS IMPLEMENTATIONS ========================

// 1. Overview Tab
function OverviewTab() {
  const query = useAnalyticsDashboard<{
    revenueTrend: Array<{ date: string; revenue: number }>;
    noShowRate: number;
  }>(1);
  if (query.isLoading) return <LoaderSpinner />;

  const data = query.data?.revenueTrend || [];
  const noShowRate = query.data?.noShowRate || 0;

  return (
    <div>
      <div className="settings-grid-two" style={{ gap: '24px', marginBottom: '24px' }}>
        <div>
          <h3>📈 Динамика выручки (30 дней)</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>
            Сумма оплат по всем кассам клиники.
          </p>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div className="content-panel" style={{ padding: '24px', background: 'var(--soft)' }}>
            <h3>🚨 Качество заполняемости записей</h3>
            <p className="muted" style={{ marginTop: '6px' }}>
              Анализ пропусков приёмов на основе DwFact.
            </p>
            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div
                style={{
                  position: 'relative',
                  width: '80px',
                  height: '80px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '50%',
                  border: '4px solid var(--brand)',
                  fontSize: '18px',
                  fontWeight: 'bold',
                }}
              >
                {noShowRate.toFixed(1)}%
              </div>
              <div>
                <strong>Показатель неявок (No-Show Rate)</strong>
                <span
                  className="muted"
                  style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}
                >
                  Средний процент пациентов, пропустивших плановый визит без уведомления. Целевой
                  лимит: &lt; 15%.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Finance Tab
function FinanceTab() {
  const query = useAnalyticsDashboard<{
    cashFlow: Array<{ date: string; revenue: number; profit: number; expenses: number }>;
    paymentMethods: Array<{ method: string; value: number }>;
  }>(4);

  if (query.isLoading) return <LoaderSpinner />;

  const cashFlow = query.data?.cashFlow || [];
  const pMethods = query.data?.paymentMethods || [];

  const COLORS = ['#079685', '#2563eb', '#b45309'];

  return (
    <div>
      <div className="settings-grid-two" style={{ gap: '24px' }}>
        <div>
          <h3>💼 Структура Cash Flow</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>
            Выручка, операционная прибыль и затраты клиники.
          </p>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={cashFlow}>
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name="Выручка" fill="#079685" />
                <Bar dataKey="profit" name="Маржа" fill="#2563eb" />
                <Bar dataKey="expenses" name="Расходы" fill="#b45309" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3>💳 Способы оплаты</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>
            Доли оплат наличными, картой и по QR-кодам.
          </p>
          <div
            style={{
              width: '100%',
              height: 260,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={pMethods}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  formatter={(value, entry: any) =>
                    `${entry.payload.method}: ${entry.payload.value}%`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Operations & Doctor Tab
function OperationsTab() {
  const query = useAnalyticsDashboard<
    Array<{
      doctorId: string;
      doctorName: string;
      totalVisits: number;
      revenue: number;
      utilization: number;
      noShowRate: number;
    }>
  >(2);

  if (query.isLoading) return <LoaderSpinner />;

  const data = query.data || [];

  return (
    <div>
      <h3>🩺 Эффективность врачебного персонала</h3>
      <p className="muted" style={{ marginBottom: '16px' }}>
        Аналитика по приёмам, выручке и утилизации рабочего времени.
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Врач</th>
            <th>Всего приёмов</th>
            <th>Сумма оплат (₽)</th>
            <th>Утилизация рабочего дня (%)</th>
            <th>Показатель пропусков (%)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.doctorId}>
              <td>
                <strong>{row.doctorName}</strong>
              </td>
              <td>{row.totalVisits}</td>
              <td>{row.revenue.toLocaleString('ru-RU')} ₽</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      flex: 1,
                      height: '6px',
                      background: '#e5e7eb',
                      borderRadius: '3px',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${row.utilization}%`,
                        background: 'var(--brand)',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                  <span>{row.utilization}%</span>
                </div>
              </td>
              <td>
                <span
                  className={`settings-pill ${row.noShowRate > 15 ? 'is-danger' : 'is-success'}`}
                >
                  {row.noShowRate.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 4. Marketing Tab
function MarketingTab() {
  const query = useAnalyticsDashboard<
    Array<{
      source: string;
      leads: number;
      visits: number;
      revenue: number;
      cac: number;
    }>
  >(5);

  if (query.isLoading) return <LoaderSpinner />;

  const data = query.data || [];

  return (
    <div>
      <div className="settings-grid-two" style={{ gap: '24px' }}>
        <div>
          <h3>📣 Воронка лидогенерации по каналам</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>
            Сравнение конверсий различных источников.
          </p>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data}>
                <XAxis dataKey="source" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" name="Лиды / Заявки" fill="#2563eb" />
                <Bar dataKey="visits" name="Завершенные визиты" fill="#079685" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3>💰 Привлекательность и LTV</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>
            Накопленная ценность (LTV) клиентов.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Канал</th>
                <th>Конверсия лид → визит</th>
                <th>Выручка (₽)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const conv = row.leads > 0 ? (row.visits / row.leads) * 100 : 0;
                return (
                  <tr key={row.source}>
                    <td>
                      <strong>{row.source}</strong>
                    </td>
                    <td>{conv.toFixed(1)}%</td>
                    <td>{row.revenue.toLocaleString('ru-RU')} ₽</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 5. Forecast & ML Tab
function ForecastTab() {
  const query = useAnalyticsDashboard<Array<{ date: string; revenue: number }>>(8);
  if (query.isLoading) return <LoaderSpinner />;

  const data = query.data || [];

  return (
    <div>
      <h3>🔮 Модель предиктивной выручки на 14 дней (ML Forecast)</h3>
      <p className="muted" style={{ marginBottom: '16px' }}>
        Построено с использованием регрессионного моделирования и с учётом недельной сезонности.
      </p>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} />
            <YAxis stroke="var(--muted)" fontSize={11} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Прогноз выручки (₽)"
              stroke="#6d28d9"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 6. Metabase Tab
function MetabaseTab() {
  const query = useMetabaseToken();

  if (query.isLoading) return <LoaderSpinner />;

  const url = query.data?.iframeUrl;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3>📊 Интегрированная аналитика Metabase Self-Service</h3>
          <p className="muted">
            Встроенный интерактивный дашборд с ограничением доступа на базе JWT тенанта клиники.
          </p>
        </div>
      </div>
      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: '8px',
          overflow: 'hidden',
          height: '600px',
          background: '#f8fafc',
        }}
      >
        <iframe
          src={url}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Metabase Embed Analytical Dashboard"
        />
      </div>
    </div>
  );
}

// Utility Loader
function LoaderSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        gap: '8px',
      }}
    >
      <Loader2 className="spin" size={16} />
      <span className="muted">Загружаем данные...</span>
    </div>
  );
}
