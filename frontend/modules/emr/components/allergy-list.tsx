'use client';

import { ShieldAlert, Plus, ShieldCheck, Heart, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  usePatientAllergies,
  useAddPatientAllergy,
  usePatientChronicConditions,
  useAddPatientChronicCondition,
  usePatientPregnancy,
  useUpdatePatientPregnancy,
} from '../hooks/use-emr';
import { apiFetch } from '@/shared/api/client-api';
import { useToast } from '@/shared/ui/toast';

interface AllergyListProps {
  patientId: string;
}

export function AllergyList({ patientId }: AllergyListProps) {
  const { toast } = useToast();

  const allergiesQuery = usePatientAllergies(patientId);
  const addAllergy = useAddPatientAllergy(patientId);

  const chronicQuery = usePatientChronicConditions(patientId);
  const addChronic = useAddPatientChronicCondition(patientId);

  const pregnancyQuery = usePatientPregnancy(patientId);
  const updatePregnancy = useUpdatePatientPregnancy(patientId);

  // States for adding allergy
  const [allergenSearch, setAllergenSearch] = useState('');
  const [allergenResults, setAllergenResults] = useState<any[]>([]);
  const [selectedAllergen, setSelectedAllergen] = useState<any | null>(null);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [allergyNotes, setAllergyNotes] = useState('');

  // States for adding chronic condition
  const [icdSearch, setIcdSearch] = useState('');
  const [icdResults, setIcdResults] = useState<any[]>([]);
  const [selectedIcd, setSelectedIcd] = useState<any | null>(null);
  const [chronicNotes, setChronicNotes] = useState('');

  // States for pregnancy
  const [edd, setEdd] = useState('');
  const [pregStatus, setPregStatus] = useState<'ACTIVE' | 'COMPLETED' | 'ABORTED'>('ACTIVE');
  const [pregNotes, setPregNotes] = useState('');

  // Search allergen autocomplete
  useEffect(() => {
    if (allergenSearch.length < 2) {
      setAllergenResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await apiFetch<any[]>(
          `/emr/dicts/allergen?q=${encodeURIComponent(allergenSearch)}`,
        );
        setAllergenResults(res || []);
      } catch {
        setAllergenResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [allergenSearch]);

  // Search ICD autocomplete
  useEffect(() => {
    if (icdSearch.length < 2) {
      setIcdResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await apiFetch<any[]>(`/emr/dicts/icd?q=${encodeURIComponent(icdSearch)}`);
        setIcdResults(res || []);
      } catch {
        setIcdResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [icdSearch]);

  const handleAddAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAllergen) {
      toast('error', 'Ошибка', 'Выберите аллерген из списка автозаполнения');
      return;
    }

    try {
      await addAllergy.mutateAsync({
        allergenCode: selectedAllergen.code,
        severity,
        notes: allergyNotes,
      });
      setSelectedAllergen(null);
      setAllergenSearch('');
      setAllergyNotes('');
      toast('success', 'Аллергия добавлена', 'Данные об аллергии сохранены');
    } catch {
      toast('error', 'Ошибка', 'Не удалось добавить аллергию');
    }
  };

  const handleAddChronic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIcd) {
      toast('error', 'Ошибка', 'Выберите диагноз МКБ из автозаполнения');
      return;
    }

    try {
      await addChronic.mutateAsync({
        icdCode: selectedIcd.code,
        notes: chronicNotes,
      });
      setSelectedIcd(null);
      setIcdSearch('');
      setChronicNotes('');
      toast('success', 'Диагноз добавлен', 'Хроническое заболевание зафиксировано');
    } catch {
      toast('error', 'Ошибка', 'Не удалось сохранить заболевание');
    }
  };

  const handleUpdatePregnancy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePregnancy.mutateAsync({
        status: pregStatus,
        estimatedDeliveryDate: edd ? new Date(edd).toISOString() : null,
        notes: pregNotes,
      });
      setPregNotes('');
      setEdd('');
      toast('success', 'Статус обновлен', 'Состояние беременности сохранено');
    } catch {
      toast('error', 'Ошибка', 'Не удалось обновить статус');
    }
  };

  const allergies = allergiesQuery.data || [];
  const chronicConditions = chronicQuery.data || [];
  const activePregnancy = pregnancyQuery.data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {/* ALLERGIES SECTION */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            Аллергологический анамнез
          </h3>

          {/* Form */}
          <form onSubmit={handleAddAllergy} className="space-y-4 mb-6">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Поиск аллергена
              </label>
              <input
                type="text"
                placeholder="Введи название..."
                value={allergenSearch}
                onChange={(e) => {
                  setAllergenSearch(e.target.value);
                  if (selectedAllergen) setSelectedAllergen(null);
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
              />
              {allergenResults.length > 0 && !selectedAllergen && (
                <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg shadow-lg">
                  {allergenResults.map((all) => (
                    <button
                      key={all.code}
                      type="button"
                      onClick={() => {
                        setSelectedAllergen(all);
                        setAllergenSearch(all.titleRu || all.title);
                        setAllergenResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-850"
                    >
                      {all.titleRu || all.title} ({all.category})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Тяжесть
                </label>
                <select
                  value={severity}
                  onChange={(e: any) => setSeverity(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="mild">Легкая (mild)</option>
                  <option value="moderate">Средняя (moderate)</option>
                  <option value="severe">Тяжелая (severe)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Заметки
                </label>
                <input
                  type="text"
                  placeholder="Примечания"
                  value={allergyNotes}
                  onChange={(e) => setAllergyNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addAllergy.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg p-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Добавить аллергию
            </button>
          </form>

          {/* List */}
          <div className="space-y-2">
            {allergies.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 rounded-lg text-sm">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                Непереносимости лекарств и пищевых продуктов не зафиксированы
              </div>
            ) : (
              allergies.map((all: any) => (
                <div
                  key={all.id}
                  className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                    all.severity === 'severe'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-semibold">
                      {all.allergen.titleRu || all.allergen.title}
                    </span>
                    {all.notes && (
                      <span className="block text-xs text-slate-500 dark:text-slate-500">
                        {all.notes}
                      </span>
                    )}
                  </div>
                  <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-white/50 dark:bg-slate-800/80 border">
                    {all.severity}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CHRONIC CONDITIONS & PREGNANCY */}
      <div className="space-y-6">
        {/* CHRONIC CONDITIONS */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Heart className="h-5 w-5 text-indigo-600" />
            Хронические заболевания
          </h3>

          <form onSubmit={handleAddChronic} className="space-y-4 mb-4">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Поиск по МКБ-10
              </label>
              <input
                type="text"
                placeholder="Введи код или название диагноза..."
                value={icdSearch}
                onChange={(e) => {
                  setIcdSearch(e.target.value);
                  if (selectedIcd) setSelectedIcd(null);
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
              />
              {icdResults.length > 0 && !selectedIcd && (
                <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg shadow-lg">
                  {icdResults.map((diag) => (
                    <button
                      key={diag.code}
                      type="button"
                      onClick={() => {
                        setSelectedIcd(diag);
                        setIcdSearch(`${diag.code} - ${diag.titleRu || diag.title}`);
                        setIcdResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-850"
                    >
                      <span className="font-semibold text-teal-600 mr-2">{diag.code}</span>
                      {diag.titleRu || diag.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Примечания
              </label>
              <input
                type="text"
                placeholder="Напр. Диагноз подтвержден в 2021 году"
                value={chronicNotes}
                onChange={(e) => setChronicNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={addChronic.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Добавить заболевание
            </button>
          </form>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {chronicConditions.length === 0 ? (
              <div className="text-xs text-slate-400 dark:text-slate-600 text-center py-2">
                Нет хронических заболеваний
              </div>
            ) : (
              chronicConditions.map((cond: any) => (
                <div
                  key={cond.id}
                  className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 flex justify-between text-slate-700 dark:text-slate-300"
                >
                  <div>
                    <span className="font-semibold text-teal-600 mr-2">{cond.icdCode}</span>
                    {cond.notes && (
                      <span className="text-xs text-slate-500 block">{cond.notes}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PREGNANCY CARD */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Sparkles className="h-5 w-5 text-pink-500" />
            Материнство / Беременность
          </h3>

          <form onSubmit={handleUpdatePregnancy} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Статус
                </label>
                <select
                  value={pregStatus}
                  onChange={(e: any) => setPregStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="ACTIVE">Активна (ACTIVE)</option>
                  <option value="COMPLETED">Завершена (COMPLETED)</option>
                  <option value="ABORTED">Прервана (ABORTED)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  ПДР (Дата родов)
                </label>
                <input
                  type="date"
                  value={edd}
                  onChange={(e) => setEdd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Примечания
              </label>
              <input
                type="text"
                placeholder="Срок в неделях, особенности"
                value={pregNotes}
                onChange={(e) => setPregNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-sm bg-slate-50 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={updatePregnancy.isPending}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white rounded-lg p-2 text-sm font-medium transition-colors"
            >
              Сохранить статус
            </button>
          </form>

          {activePregnancy && (
            <div className="mt-4 p-3 bg-pink-50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/30 text-pink-700 dark:text-pink-400 rounded-lg text-sm">
              <span className="font-semibold block">Текущий статус: БЕРЕМЕННОСТЬ АКТИВНА</span>
              {activePregnancy.estimatedDeliveryDate && (
                <span>
                  Ожидаемая дата родов:{' '}
                  {new Date(activePregnancy.estimatedDeliveryDate).toLocaleDateString()}
                </span>
              )}
              {activePregnancy.notes && (
                <span className="block text-xs mt-1 text-slate-500">{activePregnancy.notes}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
