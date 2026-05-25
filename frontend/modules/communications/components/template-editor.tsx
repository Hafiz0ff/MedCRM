'use client';

import { Sparkles, MessageSquare, Mail, AlertCircle, HelpCircle, Check, Info } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/button';

interface TemplateEditorProps {
  template?: {
    id?: string;
    templateCode: string;
    templateName: string;
    channelType: string;
    languageCode: string;
    subject?: string | null;
    templateBody: string;
    variablesJson?: any;
  } | null;
  onSave: (data: {
    templateCode: string;
    templateName: string;
    channelType: string;
    languageCode: string;
    subject?: string | null;
    templateBody: string;
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

const VARIABLE_SUGGESTIONS = [
  { label: 'ФИО Пациента', value: '{{patient.fullName}}', example: 'Иванов Иван Иванович' },
  { label: 'Код Пациента', value: '{{patient.patientCode}}', example: 'P-000452' },
  { label: 'Имя Врача', value: '{{doctor.firstName}}', example: 'Алишер' },
  { label: 'Фамилия Врача', value: '{{doctor.lastName}}', example: 'Собиров' },
  { label: 'Время Визита', value: '{{appointment.startAt}}', example: '26 мая 2026, в 14:00' },
  { label: 'Номер Записи', value: '{{appointment.appointmentNumber}}', example: 'A-000108' },
  { label: 'Название Клиники', value: '{{clinic.name}}', example: 'Медицинский центр "Шифо"' },
];

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  isSaving = false,
}: TemplateEditorProps) {
  const [templateName, setTemplateName] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [channelType, setChannelType] = useState('TELEGRAM');
  const [languageCode, setLanguageCode] = useState('ru');
  const [subject, setSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setTemplateName(template.templateName);
      setTemplateCode(template.templateCode);
      setChannelType(template.channelType);
      setLanguageCode(template.languageCode);
      setSubject(template.subject || '');
      setTemplateBody(template.templateBody);
    } else {
      setTemplateName('');
      setTemplateCode('');
      setChannelType('TELEGRAM');
      setLanguageCode('ru');
      setSubject('');
      setTemplateBody('');
    }
  }, [template]);

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = templateBody;
    const newText = currentText.substring(0, start) + variable + currentText.substring(end);

    setTemplateBody(newText);

    // Focus back and set cursor position after variable insertion
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variable.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  // Compile helper to display live preview
  const getCompiledPreview = () => {
    let result = templateBody;
    VARIABLE_SUGGESTIONS.forEach((sug) => {
      // Replace all occurrences
      result = result.split(sug.value).join(sug.example);
    });
    return result || 'Введите текст шаблона для предварительного просмотра...';
  };

  // Character counters & SMS segments calculation
  const hasCyrillic = (text: string) => /[а-яА-ЯёЁ]/.test(text);
  const charCount = templateBody.length;

  const getSmsCalculation = () => {
    if (channelType !== 'SMS') return null;

    const cyrillic = hasCyrillic(templateBody);
    const limit = cyrillic ? 70 : 160;
    const multipartLimit = cyrillic ? 67 : 153;

    let segments = 1;
    let charsLeft = limit - charCount;

    if (charCount > limit) {
      segments = Math.ceil(charCount / multipartLimit);
      charsLeft = segments * multipartLimit - charCount;
    }

    return {
      limit,
      multipartLimit,
      segments,
      charsLeft,
      cyrillic,
    };
  };

  const smsCalc = getSmsCalculation();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName || !templateCode || !templateBody) return;
    onSave({
      templateCode,
      templateName,
      channelType,
      languageCode,
      subject: channelType === 'EMAIL' ? subject : null,
      templateBody,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-1">
      {/* Left side: Editor Form */}
      <form
        onSubmit={handleFormSubmit}
        className="lg:col-span-7 flex flex-col gap-5 bg-surface border border-border p-5 rounded-lg"
      >
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {template ? 'Редактировать шаблон' : 'Создать новый шаблон'}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted" htmlFor="templateCode">
              Код шаблона (ID)
            </label>
            <input
              id="templateCode"
              disabled={!!template}
              required
              className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink disabled:bg-surface-soft disabled:text-muted focus:outline-hidden focus:border-brand transition-colors"
              placeholder="e.g. appointment.reminder.24h"
              value={templateCode}
              onChange={(e) =>
                setTemplateCode(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted" htmlFor="templateName">
              Название шаблона
            </label>
            <input
              id="templateName"
              required
              className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand transition-colors"
              placeholder="e.g. Напоминание за 24 часа"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted" htmlFor="channelType">
              Канал доставки
            </label>
            <select
              id="channelType"
              disabled={!!template}
              className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand transition-colors"
              value={channelType}
              onChange={(e) => setChannelType(e.target.value)}
            >
              <option value="TELEGRAM">Telegram</option>
              <option value="SMS">SMS-сообщение</option>
              <option value="EMAIL">Email-письмо</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted" htmlFor="languageCode">
              Язык шаблона
            </label>
            <select
              id="languageCode"
              disabled={!!template}
              className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand transition-colors"
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
            >
              <option value="ru">Русский (RU)</option>
              <option value="tg">Тоҷикӣ (TG)</option>
              <option value="en">English (EN)</option>
            </select>
          </div>
        </div>

        {channelType === 'EMAIL' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted" htmlFor="subject">
              Тема письма
            </label>
            <input
              id="subject"
              required
              className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand transition-colors"
              placeholder="e.g. Напоминание о записи на прием в клинику"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-muted" htmlFor="templateBody">
              Шаблон сообщения (поддерживает Handlebars)
            </label>
            <span
              className={`text-[11px] font-medium ${charCount > 500 ? 'text-warning' : 'text-muted'}`}
            >
              Символов: {charCount}
            </span>
          </div>
          <textarea
            id="templateBody"
            ref={textareaRef}
            required
            rows={7}
            className="px-3 py-2 text-sm font-mono border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand transition-colors resize-y"
            placeholder="Здравствуйте, {{patient.fullName}}! Напоминаем Вам о записи к врачу {{doctor.lastName}} на {{appointment.startAt}}..."
            value={templateBody}
            onChange={(e) => setTemplateBody(e.target.value)}
          />
        </div>

        {/* Variables Whitelist suggestion helper */}
        <div className="flex flex-col gap-2 bg-surface-soft p-3.5 rounded-md border border-border">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
            <Sparkles size={14} />
            <span>Переменные для автозаполнения</span>
          </div>
          <p className="text-[11px] text-muted">
            Нажмите на переменную ниже, чтобы вставить её в позицию курсора:
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {VARIABLE_SUGGESTIONS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => insertVariable(v.value)}
                className="px-2 py-1 text-xs bg-surface border border-border text-ink rounded-md hover:border-brand hover:bg-brand-soft hover:text-brand-strong transition-all cursor-pointer"
                title={`Пример: ${v.example}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* SMS Segment info pane */}
        {channelType === 'SMS' && smsCalc && (
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-warning-soft border border-warning/20 text-warning-strong">
            <AlertCircle className="shrink-0 text-warning mt-0.5" size={16} />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink">Расчет SMS сегментов</span>
              <p className="text-muted leading-relaxed">
                Содержит кириллицу:{' '}
                <strong>{smsCalc.cyrillic ? 'Да (лимит 70)' : 'Нет (лимит 160)'}</strong>. Сообщение
                будет отправлено как <strong>{smsCalc.segments} SMS</strong> ({charCount} симв.).
                Осталось символов до следующего сегмента: <strong>{smsCalc.charsLeft}</strong>.
              </p>
              {smsCalc.segments > 1 && (
                <span className="text-[11px] font-medium text-warning-strong mt-0.5">
                  ⚠️ Внимание! Стоимость отправки увеличится в {smsCalc.segments} раз. Попробуйте
                  укоротить текст.
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={isSaving || !templateName || !templateCode || !templateBody}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить шаблон'}
          </Button>
        </div>
      </form>

      {/* Right side: Premium Live Preview Frame */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="flex items-center gap-1.5 px-1">
          <Info size={14} className="text-brand" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Предпросмотр на устройстве
          </span>
        </div>

        {/* Mobile Mockup Device */}
        <div className="relative mx-auto w-full max-w-[340px] aspect-[9/18] bg-black rounded-[40px] border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col">
          {/* Ear piece notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-20 flex items-center justify-center">
            <div className="w-12 h-1 bg-black rounded-full" />
          </div>

          {/* Screen Content Wrapper */}
          <div className="flex-1 bg-slate-900 pt-8 pb-4 px-4 flex flex-col z-10 overflow-hidden">
            {/* Conditional telegram header or sms header */}
            {channelType === 'TELEGRAM' ? (
              <div className="flex flex-col gap-1 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                    Bot
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-white truncate leading-tight">
                      MedCRM Bot
                    </h3>
                    <span className="text-[10px] text-brand-300">bot</span>
                  </div>
                </div>
              </div>
            ) : channelType === 'SMS' ? (
              <div className="flex flex-col items-center pb-2.5 border-b border-slate-800">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  M
                </div>
                <h3 className="text-[11px] font-bold text-white mt-1">MedCRM Notification</h3>
              </div>
            ) : (
              <div className="flex flex-col gap-1 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-1.5 text-xs text-white">
                  <Mail size={12} className="text-muted" />
                  <span className="font-bold truncate">{subject || 'Тема отсутствует'}</span>
                </div>
                <span className="text-[10px] text-muted">От: noreply@medcrm.tj</span>
              </div>
            )}

            {/* Simulated Chatport area */}
            <div className="flex-1 overflow-y-auto py-4 flex flex-col justify-end gap-3 min-h-0">
              {/* Telegram/SMS Chat bubbles */}
              {channelType === 'TELEGRAM' ? (
                <div className="flex flex-col gap-3">
                  {/* System command invitation */}
                  <div className="self-center bg-slate-800/80 px-2.5 py-0.5 rounded-full text-[9px] text-slate-400">
                    Начало диалога с ботом
                  </div>

                  {/* Outbound compiled bubble */}
                  <div className="self-start max-w-[85%] bg-slate-800 text-white p-3 rounded-2xl rounded-tl-none shadow-md border border-slate-700/50 text-xs leading-relaxed whitespace-pre-wrap animate-fade-in">
                    {getCompiledPreview()}

                    {/* Simulated Inline Keyboard for Telegram */}
                    {templateBody.includes('Подтвердите') || templateBody.includes('Да') ? (
                      <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-700/60">
                        <button
                          type="button"
                          disabled
                          className="py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-[10px] font-bold rounded-lg text-white text-center cursor-not-allowed"
                        >
                          ✅ Да, приду
                        </button>
                        <button
                          type="button"
                          disabled
                          className="py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-[10px] font-bold rounded-lg text-white text-center cursor-not-allowed"
                        >
                          ❌ Нет
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : channelType === 'SMS' ? (
                <div className="self-start max-w-[90%] bg-emerald-600 text-white p-3 rounded-xl rounded-bl-none shadow-md text-xs leading-relaxed whitespace-pre-wrap animate-fade-in">
                  {getCompiledPreview()}
                </div>
              ) : (
                /* Email pane in phone */
                <div className="flex-1 bg-white text-black p-3.5 rounded-lg shadow-inner overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap border border-slate-700">
                  <div className="border-b pb-2 mb-2">
                    <span className="font-bold text-slate-700">Здравствуйте!</span>
                  </div>
                  {getCompiledPreview()}
                  <div className="mt-4 pt-3 border-t text-[10px] text-slate-400 text-center">
                    Это автоматическое напоминание от MedCRM
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Input Area of Phone */}
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-2">
              <input
                disabled
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-[10px] text-slate-400 cursor-not-allowed"
                placeholder="Только для чтения"
              />
              <button
                disabled
                type="button"
                className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white cursor-not-allowed"
              >
                <Check size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
