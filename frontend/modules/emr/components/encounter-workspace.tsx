'use client';

import {
  X,
  Award,
  FileCode,
  CheckCircle,
  FileText,
  Lock,
  Plus,
  Trash2,
  Search,
  History,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  useEncounterDetails,
  useEncounterVersions,
  useSaveEncounterDraft,
  useSignEncounter,
  useAmendEncounter,
  useAssignDiagnosis,
  useCreatePrescription,
  useClinicalTemplates,
  Encounter,
} from '../hooks/use-emr';
import { apiFetch } from '@/shared/api/client-api';
import { useToast } from '@/shared/ui/toast';

interface EncounterWorkspaceProps {
  patientId: string;
  encounterId?: string; // If undefined, we are in create mode
  onClose: () => void;
}

export function EncounterWorkspace({ patientId, encounterId, onClose }: EncounterWorkspaceProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'editor' | 'prescriptions' | 'fhir' | 'versions'>(
    'editor',
  );

  // Loading and mutations
  const templatesQuery = useClinicalTemplates();
  const detailsQuery = useEncounterDetails(encounterId || '');
  const versionsQuery = useEncounterVersions(encounterId || '');
  const saveDraft = useSaveEncounterDraft(patientId);
  const signEncounter = useSignEncounter(patientId, encounterId || '');
  const amendEncounter = useAmendEncounter(patientId, encounterId || '');
  const assignDiagnosis = useAssignDiagnosis(patientId, encounterId || '');
  const createPrescription = useCreatePrescription(patientId, encounterId || '');

  // Form states
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [encounterType, setEncounterType] = useState('CONSULTATION');
  const [startedAt, setStartedAt] = useState(new Date().toISOString());

  // Dynamic composition content state
  // key: sectionCode_fieldCode, value: text/number
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // ICD-10 Diagnosis search states
  const [diagSearch, setDiagSearch] = useState('');
  const [diagResults, setDiagResults] = useState<any[]>([]);
  const [selectedDiagType, setSelectedDiagType] = useState<
    'PRELIMINARY' | 'CLINICAL' | 'FINAL' | 'DIFFERENTIAL'
  >('CLINICAL');
  const [diagNotes, setDiagNotes] = useState('');

  // Prescription states
  const [presType, setPresType] = useState<
    'MEDICATION' | 'LAB_ORDER' | 'PROCEDURE' | 'IMAGING' | 'REFERRAL'
  >('MEDICATION');
  const [presNotes, setPresNotes] = useState('');
  const [presItems, setPresItems] = useState<
    Array<{
      itemCode: string;
      itemName: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      instructions?: string;
    }>
  >([]);
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDosage, setItemDosage] = useState('');
  const [itemFrequency, setItemFrequency] = useState('');
  const [itemDuration, setItemDuration] = useState('');

  // Digital Signature state
  const [showSignModal, setShowSignModal] = useState(false);
  const [sigProvider, setSigProvider] = useState('CryptoPro CSP');
  const [sigCertSerial, setSigCertSerial] = useState('7B00192CA18EF12A09');

  // FHIR raw state
  const [fhirViewType, setFhirViewType] = useState<'Patient' | 'Encounter' | 'Observation'>(
    'Encounter',
  );
  const [fhirJson, setFhirJson] = useState<any>(null);
  const [loadingFhir, setLoadingFhir] = useState(false);

  // Amendment states
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendReason, setAmendReason] = useState('');

  // Loaded encounter instance shortcut
  const encounter = detailsQuery.data;

  // Load template dynamically
  const templates = templatesQuery.data || [];
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Sync state if loading existing encounter
  useEffect(() => {
    if (encounter) {
      setEncounterType(encounter.encounterType);
      setStartedAt(encounter.startedAt);

      // Extract form values from compositions
      const values: Record<string, any> = {};
      encounter.compositions?.forEach((comp) => {
        comp.sections?.forEach((sec) => {
          sec.elements?.forEach((el) => {
            values[`${sec.sectionCode}_${el.fieldCode}`] = el.fieldValueJson;
          });
        });
      });
      setFormValues(values);

      if (encounter.compositions?.[0]?.templateId) {
        setSelectedTemplateId(encounter.compositions[0].templateId);
      }
    }
  }, [encounter]);

  // Handle template switch: populate default empty schema values
  useEffect(() => {
    if (selectedTemplate && !encounter) {
      const defaultValues: Record<string, any> = {};
      selectedTemplate.schemaJson?.properties?.compositions?.items?.properties?.sections?.items?.properties?.elements?.items?.properties?.forEach(
        (el: any) => {
          // Build defaults
        },
      );
      setFormValues(defaultValues);
    }
  }, [selectedTemplate, encounter]);

  // Debounced search ICD-10 diagnoses
  useEffect(() => {
    if (diagSearch.length < 2) {
      setDiagResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await apiFetch<any[]>(
          `/emr/diagnoses/search?q=${encodeURIComponent(diagSearch)}`,
        );
        setDiagResults(res || []);
      } catch {
        setDiagResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [diagSearch]);

  const handleFieldChange = (sectionCode: string, fieldCode: string, val: any) => {
    setFormValues((prev) => ({
      ...prev,
      [`${sectionCode}_${fieldCode}`]: val,
    }));
  };

  const handleSaveDraftSubmit = async () => {
    // Collect form state into backend SaveEncounterDto format
    const compositions = selectedTemplate
      ? [
          {
            templateId: selectedTemplate.id,
            compositionType: 'CLINICAL_NOTE',
            title: selectedTemplate.name,
            sections: Object.entries(selectedTemplate.schemaJson?.sections || {}).map(
              ([secCode, secData]: [string, any]) => ({
                sectionCode: secCode,
                sectionName: secData.name,
                sortOrder: secData.sortOrder || 1,
                elements: Object.entries(secData.fields || {}).map(
                  ([fieldCode, fieldData]: [string, any]) => ({
                    fieldCode,
                    fieldType: fieldData.type,
                    fieldValueJson: formValues[`${secCode}_${fieldCode}`] ?? '',
                    unit: fieldData.unit || null,
                    terminologyCode: fieldData.terminologyCode || null,
                  }),
                ),
              }),
            ),
          },
        ]
      : [
          {
            compositionType: 'UNSTRUCTURED',
            title: 'Свободный протокол приема',
            sections: [
              {
                sectionCode: 'free_text',
                sectionName: 'Клиническое примечание',
                sortOrder: 1,
                elements: [
                  {
                    fieldCode: 'note',
                    fieldType: 'STRING',
                    fieldValueJson: formValues['free_text_note'] ?? '',
                  },
                ],
              },
            ],
          },
        ];

    const inputPayload = {
      id: encounterId,
      doctorEmployeeId: encounter?.doctorEmployeeId || 'd57fe15f-449b-4048-a744-9b5b3282c4a8', // default doctor
      encounterType,
      startedAt,
      compositions,
    };

    saveDraft.mutate(inputPayload, {
      onSuccess: (saved) => {
        toast('success', 'Черновик приема успешно сохранен');
        if (!encounterId) {
          // If we just created, reload page or close
          onClose();
        } else {
          detailsQuery.refetch();
        }
      },
      onError: (err: any) => {
        toast('error', err.message || 'Ошибка сохранения черновика');
      },
    });
  };

  const handleAddDiagnosis = (diag: any) => {
    if (!encounterId) {
      toast('warning', 'Сохраните прием как черновик перед добавлением диагноза');
      return;
    }

    assignDiagnosis.mutate(
      {
        diagnosisCode: diag.code,
        diagnosisType: selectedDiagType,
        isPrimary: selectedDiagType === 'CLINICAL', // auto primary for clinical
        notes: diagNotes || diag.name,
      },
      {
        onSuccess: () => {
          toast('success', `Диагноз ${diag.code} успешно добавлен к приему`);
          setDiagSearch('');
          setDiagNotes('');
          detailsQuery.refetch();
        },
        onError: (err: any) => {
          toast('error', err.message || 'Ошибка привязки диагноза');
        },
      },
    );
  };

  const handleAddPrescriptionItem = () => {
    if (!itemCode || !itemName) return;
    setPresItems((prev) => [
      ...prev,
      {
        itemCode,
        itemName,
        dosage: itemDosage,
        frequency: itemFrequency,
        duration: itemDuration,
      },
    ]);
    setItemCode('');
    setItemName('');
    setItemDosage('');
    setItemFrequency('');
    setItemDuration('');
  };

  const handleRemovePrescriptionItem = (idx: number) => {
    setPresItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreatePrescriptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!encounterId) {
      toast('warning', 'Сохраните прием как черновик перед добавлением назначений');
      return;
    }
    if (presItems.length === 0) return;

    createPrescription.mutate(
      {
        prescriptionType: presType as any,
        notes: presNotes,
        items: presItems,
      },
      {
        onSuccess: () => {
          toast('success', 'Назначение успешно добавлено к протоколу');
          setPresNotes('');
          setPresItems([]);
          detailsQuery.refetch();
        },
        onError: (err: any) => {
          toast('error', err.message || 'Ошибка создания назначения');
        },
      },
    );
  };

  const handleSignSubmit = () => {
    if (!encounterId) return;

    // Simulate crypto hash generation
    const docContent = JSON.stringify(formValues);
    const hash = 'SHA256:' + btoa(docContent).slice(0, 40);

    signEncounter.mutate(
      {
        signatureProvider: sigProvider,
        certificateSerial: sigCertSerial,
        signatureHash: hash,
      },
      {
        onSuccess: () => {
          setShowSignModal(false);
          toast('success', 'Протокол приема успешно подписан и заблокирован ЭЦП');
          detailsQuery.refetch();
        },
        onError: (err: any) => {
          toast('error', err.message || 'Не удалось подписать протокол');
        },
      },
    );
  };

  const handleAmendSubmit = () => {
    if (!encounterId || !amendReason) return;

    amendEncounter.mutate(
      {
        amendmentReason: amendReason,
      },
      {
        onSuccess: () => {
          setShowAmendModal(false);
          setAmendReason('');
          toast('success', 'Создан новый черновик приеме на базе предыдущего протокола');
          detailsQuery.refetch();
          versionsQuery.refetch();
        },
        onError: (err: any) => {
          toast('error', err.message || 'Не удалось открыть корректировку');
        },
      },
    );
  };

  // Load FHIR Export content
  const loadFhirData = async () => {
    if (!encounterId) return;
    setLoadingFhir(true);
    try {
      const url = `/emr/fhir/${fhirViewType}/${fhirViewType === 'Patient' ? patientId : encounterId}`;
      const data = await apiFetch<any>(url);
      setFhirJson(data);
    } catch (err: any) {
      toast('error', 'Не удалось загрузить FHIR экспорты');
      setFhirJson(null);
    } finally {
      setLoadingFhir(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'fhir' && encounterId) {
      loadFhirData();
    }
  }, [activeTab, fhirViewType]);

  const isSigned = encounter?.status === 'SIGNED';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'var(--bg)',
          width: '100%',
          maxWidth: '1200px',
          height: '100%',
          maxHeight: '850px',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="eyebrow">Клинический редактор</span>
              {isSigned ? (
                <span
                  className="status-badge status-success"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                >
                  <Lock size={12} /> ЗАКРЫТ ЭЦП
                </span>
              ) : (
                <span className="status-badge status-warning" style={{ fontSize: '11px' }}>
                  ЧЕРНОВИК
                </span>
              )}
            </div>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '1.25rem' }}>
              {encounterId ? `Прием: ${encounter?.encounterType}` : 'Регистрация нового приема'}
            </h1>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px' }}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </header>

        {/* Tab view controllers */}
        <nav
          style={{
            padding: '0 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-soft)',
            display: 'flex',
            gap: '20px',
          }}
          aria-label="Разделы клинической карты"
        >
          <button
            onClick={() => setActiveTab('editor')}
            style={{
              padding: '12px 4px',
              borderBottom:
                activeTab === 'editor' ? '2px solid var(--brand)' : '2px solid transparent',
              color: activeTab === 'editor' ? 'var(--brand)' : 'var(--muted)',
              fontWeight: activeTab === 'editor' ? 600 : 500,
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
            type="button"
          >
            Протокол приема
          </button>
          <button
            onClick={() => setActiveTab('prescriptions')}
            style={{
              padding: '12px 4px',
              borderBottom:
                activeTab === 'prescriptions' ? '2px solid var(--brand)' : '2px solid transparent',
              color: activeTab === 'prescriptions' ? 'var(--brand)' : 'var(--muted)',
              fontWeight: activeTab === 'prescriptions' ? 600 : 500,
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
            type="button"
          >
            Назначения & Рецепты
          </button>
          {encounterId && (
            <>
              <button
                onClick={() => setActiveTab('fhir')}
                style={{
                  padding: '12px 4px',
                  borderBottom:
                    activeTab === 'fhir' ? '2px solid var(--brand)' : '2px solid transparent',
                  color: activeTab === 'fhir' ? 'var(--brand)' : 'var(--muted)',
                  fontWeight: activeTab === 'fhir' ? 600 : 500,
                  background: 'transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                }}
                type="button"
              >
                FHIR Экспорт
              </button>
              <button
                onClick={() => setActiveTab('versions')}
                style={{
                  padding: '12px 4px',
                  borderBottom:
                    activeTab === 'versions' ? '2px solid var(--brand)' : '2px solid transparent',
                  color: activeTab === 'versions' ? 'var(--brand)' : 'var(--muted)',
                  fontWeight: activeTab === 'versions' ? 600 : 500,
                  background: 'transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                }}
                type="button"
              >
                История изменений
              </button>
            </>
          )}
        </nav>

        {/* Content body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* TAB 1: Main Clinical Editor */}
          {activeTab === 'editor' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 340px',
                gap: '24px',
                height: '100%',
                alignItems: 'start',
              }}
            >
              {/* Left Form column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Template Selector / Basic Details */}
                <section className="content-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="field">
                      <label htmlFor="encounterType">Тип приема</label>
                      <select
                        id="encounterType"
                        disabled={isSigned}
                        value={encounterType}
                        onChange={(e) => setEncounterType(e.target.value)}
                        style={{
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                        }}
                      >
                        <option value="CONSULTATION">Первичная консультация</option>
                        <option value="FOLLOW_UP">Повторный прием</option>
                        <option value="DIAGNOSTIC_PROCEDURE">Диагностическая процедура</option>
                        <option value="THERAPEUTIC_PROCEDURE">Лечебная процедура</option>
                      </select>
                    </div>
                    {!encounterId && (
                      <div className="field">
                        <label htmlFor="templateSelect">Шаблон осмотра</label>
                        <select
                          id="templateSelect"
                          value={selectedTemplateId}
                          onChange={(e) => {
                            setSelectedTemplateId(e.target.value);
                            // Load custom form schema
                          }}
                          style={{
                            padding: '8px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: 'var(--surface)',
                            color: 'var(--ink)',
                          }}
                        >
                          <option value="">Свободный текст</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} (v{t.version})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </section>

                {/* Form fields based on selected template */}
                <section className="content-panel" style={{ padding: '20px' }}>
                  <h3>Протокол осмотра</h3>

                  {selectedTemplate ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        marginTop: '16px',
                      }}
                    >
                      {Object.entries(selectedTemplate.schemaJson?.sections || {}).map(
                        ([secCode, secData]: [string, any]) => (
                          <div
                            key={secCode}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              paddingBottom: '20px',
                            }}
                          >
                            <h4 style={{ margin: '0 0 12px 0', color: 'var(--brand)' }}>
                              {secData.name}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {Object.entries(secData.fields || {}).map(
                                ([fieldCode, fieldData]: [string, any]) => {
                                  const valKey = `${secCode}_${fieldCode}`;
                                  return (
                                    <div key={fieldCode} className="field">
                                      <label
                                        htmlFor={valKey}
                                        style={{ display: 'flex', justifyContent: 'space-between' }}
                                      >
                                        <span>{fieldData.label}</span>
                                        {fieldData.unit && (
                                          <span className="muted" style={{ fontSize: '12px' }}>
                                            Единица: {fieldData.unit}
                                          </span>
                                        )}
                                      </label>
                                      {fieldData.type === 'TEXT' || fieldData.type === 'STRING' ? (
                                        <textarea
                                          id={valKey}
                                          disabled={isSigned}
                                          value={formValues[valKey] || ''}
                                          onChange={(e) =>
                                            handleFieldChange(secCode, fieldCode, e.target.value)
                                          }
                                          style={{
                                            padding: '8px',
                                            border: '1px solid var(--border)',
                                            borderRadius: '6px',
                                            background: 'var(--surface)',
                                            color: 'var(--ink)',
                                            minHeight: '60px',
                                          }}
                                        />
                                      ) : (
                                        <input
                                          id={valKey}
                                          disabled={isSigned}
                                          type={fieldData.type === 'NUMBER' ? 'number' : 'text'}
                                          value={formValues[valKey] ?? ''}
                                          onChange={(e) =>
                                            handleFieldChange(
                                              secCode,
                                              fieldCode,
                                              fieldData.type === 'NUMBER'
                                                ? Number(e.target.value)
                                                : e.target.value,
                                            )
                                          }
                                          style={{
                                            padding: '8px',
                                            border: '1px solid var(--border)',
                                            borderRadius: '6px',
                                            background: 'var(--surface)',
                                            color: 'var(--ink)',
                                          }}
                                        />
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="field" style={{ marginTop: '16px' }}>
                      <label htmlFor="freeNote">Клиническое примечание (Свободный ввод)</label>
                      <textarea
                        id="freeNote"
                        disabled={isSigned}
                        placeholder="Введите протокол осмотра, жалобы, рекомендации..."
                        value={formValues['free_text_note'] || ''}
                        onChange={(e) => handleFieldChange('free_text', 'note', e.target.value)}
                        style={{
                          padding: '12px',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                          minHeight: '300px',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                  )}

                  {!isSigned && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                      <button
                        className="button"
                        onClick={handleSaveDraftSubmit}
                        disabled={saveDraft.isPending}
                      >
                        {saveDraft.isPending ? 'Сохранение...' : 'Сохранить черновик'}
                      </button>
                    </div>
                  )}
                </section>
              </div>

              {/* Right Diagnoses side column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Active Diagnoses List */}
                <section className="content-panel" style={{ padding: '16px' }}>
                  <h3>Диагнозы пациента (МКБ-10)</h3>

                  <div
                    className="list"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginTop: '12px',
                    }}
                  >
                    {encounter?.diagnoses && encounter.diagnoses.length > 0 ? (
                      encounter.diagnoses.map((d) => (
                        <div
                          key={d.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: 'var(--surface)',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '13px' }}>{d.diagnosisCode}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              Тип: {d.diagnosisType}
                            </div>
                            {d.notes && (
                              <div
                                style={{ fontSize: '11px', color: 'var(--ink)', marginTop: '2px' }}
                              >
                                {d.notes}
                              </div>
                            )}
                          </div>
                          {d.isPrimary && <span className="today-badge">Основной</span>}
                        </div>
                      ))
                    ) : (
                      <span className="muted" style={{ fontSize: '13px' }}>
                        Диагнозы не установлены
                      </span>
                    )}
                  </div>
                </section>

                {/* ICD-10 search tool */}
                {!isSigned && (
                  <section className="content-panel" style={{ padding: '16px' }}>
                    <h3>Добавить диагноз</h3>
                    <div className="field" style={{ marginTop: '12px' }}>
                      <label htmlFor="diagSearchInput">Поиск по МКБ-10</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="diagSearchInput"
                          placeholder="Код или название диагноза..."
                          value={diagSearch}
                          onChange={(e) => setDiagSearch(e.target.value)}
                          style={{
                            padding: '8px 32px 8px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: 'var(--surface)',
                            color: 'var(--ink)',
                            width: '100%',
                          }}
                        />
                        <Search
                          size={16}
                          className="muted"
                          style={{ position: 'absolute', right: '10px', top: '10px' }}
                        />
                      </div>
                    </div>

                    {diagResults.length > 0 && (
                      <div
                        style={{
                          maxHeight: '180px',
                          overflowY: 'auto',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          background: 'var(--surface)',
                          marginTop: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {diagResults.map((r) => (
                          <button
                            key={r.code}
                            onClick={() => handleAddDiagnosis(r)}
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              borderBottom: '1px solid var(--border)',
                              background: 'transparent',
                              borderTop: 'none',
                              borderLeft: 'none',
                              borderRight: 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: 'var(--ink)',
                            }}
                            type="button"
                          >
                            <strong>{r.code}</strong> - {r.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="field" style={{ marginTop: '12px' }}>
                      <label htmlFor="diagType">Тип клинического диагноза</label>
                      <select
                        id="diagType"
                        value={selectedDiagType}
                        onChange={(e: any) => setSelectedDiagType(e.target.value)}
                        style={{
                          padding: '6px',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                          width: '100%',
                          fontSize: '13px',
                        }}
                      >
                        <option value="PRELIMINARY">Предварительный</option>
                        <option value="CLINICAL">Клинический</option>
                        <option value="FINAL">Заключительный</option>
                        <option value="DIFFERENTIAL">Дифференциальный</option>
                      </select>
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Prescriptions and Orders */}
          {activeTab === 'prescriptions' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 340px',
                gap: '24px',
                alignItems: 'start',
              }}
            >
              {/* Prescriptions Form builder */}
              {!isSigned ? (
                <section className="content-panel" style={{ padding: '20px' }}>
                  <h3>Выписать назначение</h3>
                  <form
                    onSubmit={handleCreatePrescriptionSubmit}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      marginTop: '16px',
                    }}
                  >
                    <div className="field">
                      <label htmlFor="presTypeSelect">Категория назначения</label>
                      <select
                        id="presTypeSelect"
                        value={presType}
                        onChange={(e: any) => setPresType(e.target.value)}
                        style={{
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                        }}
                      >
                        <option value="MEDICATION">Лекарственный препарат (Рецепт)</option>
                        <option value="LAB_ORDER">Лабораторные исследования (Анализы)</option>
                        <option value="PROCEDURE">Назначение процедуры</option>
                        <option value="IMAGING">Инструментальная диагностика (Рентген, УЗИ)</option>
                        <option value="REFERRAL">Направление к врачу</option>
                      </select>
                    </div>

                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '16px',
                        background: 'var(--surface-soft)',
                      }}
                    >
                      <h4 style={{ margin: '0 0 12px 0' }}>Элементы назначения</h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="field">
                          <label htmlFor="itemCode">Код препарата/анализа</label>
                          <input
                            id="itemCode"
                            placeholder="Например: AMX-500, GLUCOSE"
                            value={itemCode}
                            onChange={(e) => setItemCode(e.target.value)}
                            style={{
                              padding: '6px',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              background: 'var(--surface)',
                            }}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="itemName">Название препарата/исследования</label>
                          <input
                            id="itemName"
                            placeholder="Амоксициллин 500мг, Глюкоза крови"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            style={{
                              padding: '6px',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              background: 'var(--surface)',
                            }}
                          />
                        </div>
                      </div>

                      {presType === 'MEDICATION' && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '12px',
                            marginTop: '12px',
                          }}
                        >
                          <div className="field">
                            <label htmlFor="itemDosage">Дозировка</label>
                            <input
                              id="itemDosage"
                              placeholder="1 капсула"
                              value={itemDosage}
                              onChange={(e) => setItemDosage(e.target.value)}
                              style={{
                                padding: '6px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                background: 'var(--surface)',
                              }}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="itemFrequency">Периодичность</label>
                            <input
                              id="itemFrequency"
                              placeholder="3 раза в день"
                              value={itemFrequency}
                              onChange={(e) => setItemFrequency(e.target.value)}
                              style={{
                                padding: '6px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                background: 'var(--surface)',
                              }}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="itemDuration">Продолжительность</label>
                            <input
                              id="itemDuration"
                              placeholder="7 дней"
                              value={itemDuration}
                              onChange={(e) => setItemDuration(e.target.value)}
                              style={{
                                padding: '6px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                background: 'var(--surface)',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          marginTop: '12px',
                          width: '100%',
                          minHeight: 'auto',
                          padding: '6px',
                        }}
                        onClick={handleAddPrescriptionItem}
                      >
                        <Plus size={14} style={{ marginRight: '4px' }} /> Добавить позицию в рецепт
                      </button>

                      {presItems.length > 0 && (
                        <div
                          style={{
                            marginTop: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          {presItems.map((item, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                background: 'var(--surface)',
                              }}
                            >
                              <span style={{ fontSize: '13px' }}>
                                <strong>{item.itemCode}</strong> - {item.itemName}
                                {item.dosage &&
                                  ` | ${item.dosage} | ${item.frequency} | ${item.duration}`}
                              </span>
                              <button
                                type="button"
                                className="ghost-button"
                                style={{ color: 'var(--danger)', padding: 0, minHeight: 'auto' }}
                                onClick={() => handleRemovePrescriptionItem(idx)}
                                aria-label="Удалить позицию"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="field">
                      <label htmlFor="presNotes">Инструкция / Комментарий врача</label>
                      <textarea
                        id="presNotes"
                        placeholder="Принимать после еды..."
                        value={presNotes}
                        onChange={(e) => setPresNotes(e.target.value)}
                        style={{
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          background: 'var(--surface)',
                          minHeight: '60px',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="button"
                      disabled={createPrescription.isPending || presItems.length === 0}
                    >
                      {createPrescription.isPending ? 'Добавление...' : 'Записать назначение'}
                    </button>
                  </form>
                </section>
              ) : (
                <div
                  className="muted"
                  style={{
                    padding: '20px',
                    border: '1px dashed var(--border)',
                    borderRadius: '8px',
                  }}
                >
                  Назначения заблокированы для изменения, так как прием подписан ЭЦП.
                </div>
              )}

              {/* Assigned prescriptions list */}
              <section className="content-panel" style={{ padding: '16px' }}>
                <h3>Существующие назначения приёма</h3>
                <div
                  className="list"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginTop: '12px',
                  }}
                >
                  {encounter?.prescriptions && encounter.prescriptions.length > 0 ? (
                    encounter.prescriptions.map((pr) => (
                      <div
                        key={pr.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '12px',
                          background: 'var(--surface)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px',
                          }}
                        >
                          <span className="status-badge status-info" style={{ fontSize: '11px' }}>
                            {pr.prescriptionType}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            ID: {pr.id.slice(0, 8)}...
                          </span>
                        </div>
                        {pr.notes && (
                          <p
                            style={{ fontSize: '13px', margin: '0 0 8px 0', color: 'var(--muted)' }}
                          >
                            {pr.notes}
                          </p>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {pr.items?.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                fontSize: '12px',
                                padding: '4px 8px',
                                background: 'var(--surface-soft)',
                                borderRadius: '4px',
                              }}
                            >
                              <strong>{item.itemCode}</strong> - {item.itemName}{' '}
                              {item.dosage &&
                                `(${item.dosage} | ${item.frequency} | ${item.duration})`}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="muted" style={{ fontSize: '13px' }}>
                      Назначения не найдены
                    </span>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: FHIR JSON Visual Exporter */}
          {activeTab === 'fhir' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '12px',
                }}
              >
                <button
                  className={`secondary-button ${fhirViewType === 'Patient' ? 'active' : ''}`}
                  onClick={() => setFhirViewType('Patient')}
                  type="button"
                >
                  Patient Resource
                </button>
                <button
                  className={`secondary-button ${fhirViewType === 'Encounter' ? 'active' : ''}`}
                  onClick={() => setFhirViewType('Encounter')}
                  type="button"
                >
                  Encounter Resource
                </button>
                <button
                  className={`secondary-button ${fhirViewType === 'Observation' ? 'active' : ''}`}
                  onClick={() => setFhirViewType('Observation')}
                  type="button"
                >
                  Observation Resource
                </button>
              </div>

              {loadingFhir ? (
                <div className="muted">Загрузка FHIR JSON ресурсов...</div>
              ) : fhirJson ? (
                <div
                  style={{
                    background: '#1e1e1e',
                    color: '#a9b7c6',
                    padding: '16px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    overflowX: 'auto',
                    maxHeight: '450px',
                  }}
                >
                  <pre>{JSON.stringify(fhirJson, null, 2)}</pre>
                </div>
              ) : (
                <div className="muted">FHIR ресурс пуст или отсутствует для данного приёма</div>
              )}
            </div>
          )}

          {/* TAB 4: Encounter Versions History */}
          {activeTab === 'versions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3>Версионная история приёма</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {versionsQuery.isLoading ? (
                  <div className="muted">Загрузка истории версий...</div>
                ) : versionsQuery.data && versionsQuery.data.length > 0 ? (
                  versionsQuery.data.map((v, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '16px',
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: 'var(--surface)',
                      }}
                    >
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        <div
                          style={{
                            background: 'var(--brand)',
                            color: '#fff',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontWeight: 'bold',
                            fontSize: '13px',
                          }}
                        >
                          {v.version}
                        </div>
                        {idx < (versionsQuery.data?.length ?? 0) - 1 && (
                          <div
                            style={{
                              width: '2px',
                              background: 'var(--border)',
                              flex: 1,
                              margin: '4px 0',
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <strong>Версия №{v.version}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          Изменено: {new Date(v.createdAt).toLocaleString('ru-RU')}
                        </div>
                        {v.amendmentReason && (
                          <p
                            style={{
                              margin: '8px 0 0 0',
                              fontSize: '13px',
                              background: 'var(--surface-soft)',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              borderLeft: '3px solid var(--brand)',
                            }}
                          >
                            <strong>Причина корректировки:</strong> {v.amendmentReason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="muted">
                    Изменения протокола не зафиксированы. Версия по умолчанию: v1.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer controls: Sign / Close / Save */}
        <footer
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            {encounterId && isSigned && (
              <button
                className="secondary-button"
                style={{ color: 'var(--brand)' }}
                onClick={() => setShowAmendModal(true)}
              >
                <History size={16} style={{ marginRight: '6px' }} /> Открыть корректировку
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="secondary-button" onClick={onClose}>
              Закрыть
            </button>
            {encounterId && !isSigned && (
              <button
                className="button"
                style={{ background: 'var(--violet)', color: '#fff' }}
                onClick={() => setShowSignModal(true)}
              >
                <Lock size={16} style={{ marginRight: '6px' }} /> Подписать ЭЦП
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--bg)',
              padding: '24px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3>Подписание медицинского протокола</h3>
            <p className="muted" style={{ fontSize: '13px', margin: '8px 0 16px 0' }}>
              Электронная цифровая подпись врача фиксирует медицинскую запись. Редактирование
              протокола после подписания блокируется.
            </p>

            <div className="field">
              <label htmlFor="sigProvider">Провайдер подписи</label>
              <input
                id="sigProvider"
                value={sigProvider}
                onChange={(e) => setSigProvider(e.target.value)}
                style={{
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  width: '100%',
                }}
              />
            </div>
            <div className="field" style={{ marginTop: '12px' }}>
              <label htmlFor="sigCert">Серийный номер сертификата</label>
              <input
                id="sigCert"
                value={sigCertSerial}
                onChange={(e) => setSigCertSerial(e.target.value)}
                style={{
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  width: '100%',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '20px',
              }}
            >
              <button className="secondary-button" onClick={() => setShowSignModal(false)}>
                Отмена
              </button>
              <button
                className="button"
                style={{ background: 'var(--violet)' }}
                onClick={handleSignSubmit}
                disabled={signEncounter.isPending}
              >
                {signEncounter.isPending ? 'Подписание...' : 'Подтвердить ЭЦП'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amendment Modal */}
      {showAmendModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--bg)',
              padding: '24px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '450px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3>Корректировка закрытого протокола</h3>
            <p className="muted" style={{ fontSize: '13px', margin: '8px 0 16px 0' }}>
              Обоснуйте причину изменения подписанного документа. Будет создан новый черновик приёма
              на базе старой версии.
            </p>

            <div className="field">
              <label htmlFor="amendReason">Причина корректировки</label>
              <textarea
                id="amendReason"
                required
                placeholder="Например: Исправление опечатки в дозировке препарата..."
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                style={{
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  width: '100%',
                  minHeight: '80px',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '20px',
              }}
            >
              <button className="secondary-button" onClick={() => setShowAmendModal(false)}>
                Отмена
              </button>
              <button
                className="button"
                onClick={handleAmendSubmit}
                disabled={amendEncounter.isPending || !amendReason}
              >
                {amendEncounter.isPending ? 'Создание...' : 'Открыть черновик'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
