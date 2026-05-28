'use client';

import { Plus, Shield, CheckCircle, FileText } from 'lucide-react';
import { useState } from 'react';
import { useDentalChart, useAddDentalEntry, useDentalProcedures } from '../hooks/use-emr';
import { useToast } from '@/shared/ui/toast';

interface DentalChartProps {
  patientId: string;
  encounterId?: string | null;
}

export function DentalChart({ patientId, encounterId }: DentalChartProps) {
  const { toast } = useToast();

  const chartQuery = useDentalChart(patientId);
  const addEntry = useAddDentalEntry(patientId);
  const proceduresQuery = useDentalProcedures();

  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<string>('O');
  const [diagnosisCode, setDiagnosisCode] = useState('K02'); // Caries default
  const [procedureCode, setProcedureCode] = useState('');
  const [notes, setNotes] = useState('');

  const entries = chartQuery.data || [];
  const procedures = proceduresQuery.data || [];

  // Group entries by tooth
  const entriesByTooth = entries.reduce<Record<number, any[]>>((acc, entry) => {
    if (!acc[entry.toothCode]) acc[entry.toothCode] = [];
    acc[entry.toothCode].push(entry);
    return acc;
  }, {});

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTooth) {
      toast('error', 'Ошибка', 'Выберите зуб на карте');
      return;
    }

    try {
      await addEntry.mutateAsync({
        toothCode: selectedTooth,
        surface: selectedSurface,
        diagnosisCode,
        procedureCode: procedureCode || null,
        notes,
        encounterId,
      });
      setNotes('');
      setProcedureCode('');
      toast('success', 'Запись добавлена', `Данные по зубу ${selectedTooth} сохранены`);
    } catch {
      toast('error', 'Ошибка', 'Не удалось сохранить запись по зубу');
    }
  };

  // Tooth rows layouts in dentistry
  const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
  const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];
  const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];

  const getToothColor = (toothCode: number) => {
    const toothEntries = entriesByTooth[toothCode] || [];
    if (toothEntries.length === 0)
      return 'bg-slate-100 hover:bg-teal-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700';

    const lastEntry = toothEntries[0];
    if (lastEntry.procedureCode) {
      return 'bg-green-100 dark:bg-green-950/40 border-green-400 text-green-700 dark:text-green-400'; // Treated
    }
    if (lastEntry.diagnosisCode === 'K02') {
      return 'bg-red-100 dark:bg-red-950/40 border-red-400 text-red-700 dark:text-red-400'; // Caries
    }
    return 'bg-indigo-100 dark:bg-indigo-950/40 border-indigo-400 text-indigo-700 dark:text-indigo-400';
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-4">
      {/* ODONTOGRAM MAP */}
      <div className="xl:col-span-2 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Shield className="h-5 w-5 text-teal-600" />
            Интерактивная карта зубов (Одонтограмма)
          </h3>

          <div className="space-y-8 py-4">
            {/* UPPER JAW */}
            <div className="space-y-2">
              <div className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Верхняя челюсть
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Upper Right */}
                <div className="flex gap-1.5 border-r border-dashed border-slate-350 pr-2">
                  {upperRight.map((code) => (
                    <button
                      key={code}
                      onClick={() => setSelectedTooth(code)}
                      className={`h-11 w-11 rounded-lg border text-sm font-bold flex flex-col items-center justify-center transition-all ${getToothColor(code)} ${
                        selectedTooth === code ? 'ring-2 ring-teal-500 scale-105 shadow-md' : ''
                      }`}
                    >
                      <span className="text-[10px] opacity-60">UR</span>
                      {code}
                    </button>
                  ))}
                </div>
                {/* Upper Left */}
                <div className="flex gap-1.5 pl-2">
                  {upperLeft.map((code) => (
                    <button
                      key={code}
                      onClick={() => setSelectedTooth(code)}
                      className={`h-11 w-11 rounded-lg border text-sm font-bold flex flex-col items-center justify-center transition-all ${getToothColor(code)} ${
                        selectedTooth === code ? 'ring-2 ring-teal-500 scale-105 shadow-md' : ''
                      }`}
                    >
                      <span className="text-[10px] opacity-60">UL</span>
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* LOWER JAW */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Lower Right */}
                <div className="flex gap-1.5 border-r border-dashed border-slate-350 pr-2">
                  {lowerRight.map((code) => (
                    <button
                      key={code}
                      onClick={() => setSelectedTooth(code)}
                      className={`h-11 w-11 rounded-lg border text-sm font-bold flex flex-col items-center justify-center transition-all ${getToothColor(code)} ${
                        selectedTooth === code ? 'ring-2 ring-teal-500 scale-105 shadow-md' : ''
                      }`}
                    >
                      <span className="text-[10px] opacity-60">LR</span>
                      {code}
                    </button>
                  ))}
                </div>
                {/* Lower Left */}
                <div className="flex gap-1.5 pl-2">
                  {lowerLeft.map((code) => (
                    <button
                      key={code}
                      onClick={() => setSelectedTooth(code)}
                      className={`h-11 w-11 rounded-lg border text-sm font-bold flex flex-col items-center justify-center transition-all ${getToothColor(code)} ${
                        selectedTooth === code ? 'ring-2 ring-teal-500 scale-105 shadow-md' : ''
                      }`}
                    >
                      <span className="text-[10px] opacity-60">LL</span>
                      {code}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Нижняя челюсть
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-4 flex gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 inline-block"></span>
              Здоровый / Нет записей
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3.5 h-3.5 rounded bg-red-100 dark:bg-red-950/45 border border-red-400 inline-block"></span>
              Кариес (Диагноз)
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3.5 h-3.5 rounded bg-green-100 dark:bg-green-950/45 border border-green-400 inline-block"></span>
              Лечение (Выполнено)
            </div>
          </div>
        </div>
      </div>

      {/* TOOTH OPERATIONS FORM & HISTORY */}
      <div className="xl:col-span-1 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
            {selectedTooth ? `Зуб №${selectedTooth} (Операции)` : 'Выберите зуб для осмотра'}
          </h3>

          {selectedTooth ? (
            <div className="space-y-4">
              <form onSubmit={handleAddEntry} className="space-y-4">
                {/* Surface Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Поверхность зуба
                  </label>
                  <select
                    value={selectedSurface}
                    onChange={(e) => setSelectedSurface(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="O">Окклюзионная (O)</option>
                    <option value="M">Медиальная (M)</option>
                    <option value="D">Дистальная (D)</option>
                    <option value="B">Вестибулярная (B)</option>
                    <option value="L">Язычная/Небная (L)</option>
                  </select>
                </div>

                {/* Diagnosis */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Диагноз (МКБ-10)
                  </label>
                  <select
                    value={diagnosisCode}
                    onChange={(e) => setDiagnosisCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="K02">Кариес зубов (K02)</option>
                    <option value="K04">Болезни пульпы и периапикальных тканей (K04)</option>
                    <option value="K05">Гингивит и болезни пародонта (K05)</option>
                    <option value="K08">Другие изменения зубов и челюстей (K08)</option>
                  </select>
                </div>

                {/* Procedure */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Лечение / Процедура
                  </label>
                  <select
                    value={procedureCode}
                    onChange={(e) => setProcedureCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">-- Без процедуры (только диагноз) --</option>
                    {procedures.map((proc) => (
                      <option key={proc.code} value={proc.code}>
                        {proc.nameRu || proc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Примечания
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Напр. Глубокий кариес, требуется анестезия"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addEntry.isPending}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-lg p-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Сохранить запись
                </button>
              </form>

              {/* Tooth history */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  История зуба №{selectedTooth}
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {!entriesByTooth[selectedTooth] || entriesByTooth[selectedTooth].length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-slate-600 py-1">
                      Нет записей лечения по этому зубу
                    </div>
                  ) : (
                    entriesByTooth[selectedTooth].map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded text-xs text-slate-600 dark:text-slate-450 space-y-1"
                      >
                        <div className="flex justify-between">
                          <span className="font-semibold text-indigo-600">
                            Сурф. {entry.surface}
                          </span>
                          <span className="text-slate-400">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {entry.diagnosisCode && (
                          <div>
                            Диагноз: <span className="font-medium">{entry.diagnosisCode}</span>
                          </div>
                        )}
                        {entry.procedureCode && (
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                            <CheckCircle className="h-3 w-3" />
                            {entry.procedureCode}
                          </div>
                        )}
                        {entry.notes && (
                          <div className="italic text-slate-500">"{entry.notes}"</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 dark:text-slate-600 text-center py-12">
              Нажмите на номер зуба на схеме одонтограммы слева, чтобы начать диагностику,
              посмотреть историю манипуляций или записать проведённые процедуры.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
