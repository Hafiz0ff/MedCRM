'use client';

import { Activity, Plus, TrendingUp, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { usePatientVitals, useLogVital } from '../hooks/use-emr';
import { useToast } from '@/shared/ui/toast';

interface VitalPanelProps {
  patientId: string;
  encounterId?: string | null;
}

export function VitalPanel({ patientId, encounterId }: VitalPanelProps) {
  const { toast } = useToast();
  const vitalsQuery = usePatientVitals(patientId);
  const logVital = useLogVital(patientId);

  const [type, setType] = useState('BP_SYS');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('mmHg');
  const [context, setContext] = useState('routine');
  const [selectedChartType, setSelectedChartType] = useState('BP_SYS');

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType.startsWith('BP')) setUnit('mmHg');
    else if (newType === 'HR') setUnit('bpm');
    else if (newType === 'TEMP') setUnit('°C');
    else if (newType === 'SPO2') setUnit('%');
    else if (newType === 'WEIGHT') setUnit('kg');
    else if (newType === 'HEIGHT') setUnit('cm');
    else setUnit('units');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || isNaN(Number(value))) {
      toast('error', 'Ошибка ввода', 'Введите корректное числовое значение');
      return;
    }

    try {
      await logVital.mutateAsync({
        encounterId,
        type,
        value: Number(value),
        unit,
        context,
      });
      setValue('');
      toast('success', 'Успешно', 'Витал-параметр успешно записан');
    } catch {
      toast('error', 'Ошибка', 'Не удалось сохранить витал-параметр');
    }
  };

  const vitals = vitalsQuery.data || [];
  const latestVitals = vitals.reduce<Record<string, any>>((acc, v) => {
    if (!acc[v.type]) {
      acc[v.type] = v;
    }
    return acc;
  }, {});

  // Prepare chart data (chronological order)
  const chartData = vitals
    .filter((v) => v.type === selectedChartType)
    .map((v) => ({
      date: new Date(v.measuredAt).toLocaleDateString(),
      [selectedChartType]: Number(v.value),
    }))
    .reverse();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
      {/* Log Vital sign form */}
      <div className="lg:col-span-1 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <Activity className="h-5 w-5 text-teal-600" />
          Запись параметров
        </h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Показатель
            </label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="BP_SYS">Систолическое АД (BP_SYS)</option>
              <option value="BP_DIA">Диастолическое АД (BP_DIA)</option>
              <option value="HR">Пульс / ЧСС (HR)</option>
              <option value="TEMP">Температура тела (TEMP)</option>
              <option value="SPO2">Сатурация O2 (SPO2)</option>
              <option value="WEIGHT">Вес тела (WEIGHT)</option>
              <option value="HEIGHT">Рост (HEIGHT)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Значение
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Напр. 120"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Ед. изм.
              </label>
              <input
                type="text"
                value={unit}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-100 dark:bg-slate-900 dark:text-slate-400 cursor-not-allowed"
                disabled
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Контекст
            </label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="routine">Плановое (routine)</option>
              <option value="triage">Сортировка (triage)</option>
              <option value="post-op">Послеоперационное (post-op)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={logVital.isPending}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-lg p-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Добавить запись
          </button>
        </form>

        {/* Latest values list */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Последние показатели
          </h4>
          <div className="space-y-2">
            {Object.keys(latestVitals).length === 0 ? (
              <div className="text-xs text-slate-400 dark:text-slate-600 text-center py-2">
                Нет записанных параметров
              </div>
            ) : (
              Object.values(latestVitals).map((v: any) => {
                const isCritical = v.alertLevel === 'CRITICAL';
                const isElevated = v.alertLevel === 'ELEVATED';
                return (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-sm border ${
                      isCritical
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400'
                        : isElevated
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="font-medium">{v.type}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {v.value} {v.unit}
                      </span>
                      {isCritical && <AlertTriangle className="h-4 w-4 text-red-600" />}
                      {isElevated && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Trend History Graph */}
      <div className="lg:col-span-2 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              График трендов
            </h3>
            <select
              value={selectedChartType}
              onChange={(e) => setSelectedChartType(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-xs bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="BP_SYS">BP_SYS (Систолическое АД)</option>
              <option value="BP_DIA">BP_DIA (Диастолическое АД)</option>
              <option value="HR">HR (Пульс)</option>
              <option value="TEMP">TEMP (Температура)</option>
              <option value="SPO2">SPO2 (Сатурация)</option>
              <option value="WEIGHT">WEIGHT (Вес)</option>
            </select>
          </div>

          <div className="h-[280px] w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-600">
                Недостаточно данных для построения графика по выбранному показателю
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-slate-100 dark:stroke-slate-800"
                  />
                  <XAxis dataKey="date" className="text-xs fill-slate-400 dark:fill-slate-600" />
                  <YAxis className="text-xs fill-slate-400 dark:fill-slate-600" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey={selectedChartType}
                    stroke="#14b8a6"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 text-xs text-slate-400 dark:text-slate-600">
          * Измерения витал-параметров производятся на приёме или в палате и сохраняются в
          медицинскую карту пациента.
        </div>
      </div>
    </div>
  );
}
