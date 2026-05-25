'use client';

import {
  Plus,
  Search,
  MessageSquare,
  Mail,
  Edit2,
  Globe2,
  Trash2,
  Layout,
  MessageCircle,
  HelpCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  MessageTemplate,
} from '../hooks/use-communications';
import { TemplateEditor } from './template-editor';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Skeleton } from '@/shared/ui/skeleton';
import { useToast } from '@/shared/ui/toast';

export function TemplatesPage() {
  const { toast } = useToast();
  const { data: templates, isLoading, isError, refetch } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('ALL');
  const [selectedLang, setSelectedLang] = useState('ALL');

  // Editor modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const handleEditClick = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleCreateClick = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleToggleActive = async (template: MessageTemplate) => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        isActive: !template.isActive,
      });
      toast(
        'success',
        'Статус обновлен',
        `Шаблон "${template.templateName}" теперь ${!template.isActive ? 'активен' : 'деактивирован'}`,
      );
    } catch (e: any) {
      toast('error', 'Ошибка', e.message || 'Не удалось обновить статус');
    }
  };

  const handleSave = async (formData: any) => {
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          templateName: formData.templateName,
          templateBody: formData.templateBody,
          variablesJson: formData.variablesJson || {},
        });
        toast('success', 'Успешно сохранено', `Шаблон "${formData.templateName}" обновлен`);
      } else {
        await createTemplate.mutateAsync(formData);
        toast('success', 'Шаблон создан', `Шаблон "${formData.templateName}" успешно создан`);
      }
      setIsEditorOpen(false);
      setEditingTemplate(null);
    } catch (e: any) {
      toast('error', 'Ошибка сохранения', e.message || 'Не удалось сохранить шаблон');
    }
  };

  // Filter templates
  const filteredTemplates =
    templates?.filter((t) => {
      const matchesSearch =
        t.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.templateCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.templateBody.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesChannel = selectedChannel === 'ALL' || t.channelType === selectedChannel;
      const matchesLang = selectedLang === 'ALL' || t.languageCode === selectedLang;

      return matchesSearch && matchesChannel && matchesLang;
    }) || [];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'TELEGRAM':
        return <MessageCircle size={16} className="text-sky-500" />;
      case 'SMS':
        return <MessageSquare size={16} className="text-emerald-500" />;
      case 'EMAIL':
        return <Mail size={16} className="text-indigo-500" />;
      default:
        return <MessageSquare size={16} className="text-muted" />;
    }
  };

  const getLangBadge = (lang: string) => {
    switch (lang) {
      case 'ru':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand bg-brand-soft px-1.5 py-0.5 rounded-sm">
            RU
          </span>
        );
      case 'tg':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-sm">
            TG
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted bg-surface-muted px-1.5 py-0.5 rounded-sm">
            {lang.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-border p-4 rounded-lg">
        <div className="flex-1 flex items-center gap-3 relative max-w-md">
          <Search size={18} className="absolute left-3 text-muted pointer-events-none" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-border bg-surface text-ink rounded-md focus:outline-hidden focus:border-brand transition-colors"
            placeholder="Поиск по коду, имени или содержимому..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Channel Select */}
          <select
            className="px-3 py-2 text-xs font-medium border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand cursor-pointer"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
          >
            <option value="ALL">Все каналы</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>

          {/* Lang Select */}
          <select
            className="px-3 py-2 text-xs font-medium border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand cursor-pointer"
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
          >
            <option value="ALL">Все языки</option>
            <option value="ru">Русский (ru)</option>
            <option value="tg">Тоҷикӣ (tg)</option>
            <option value="en">English (en)</option>
          </select>

          <Button onClick={handleCreateClick} className="flex items-center gap-1.5">
            <Plus size={16} />
            <span>Новый шаблон</span>
          </Button>
        </div>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border border-border p-5 rounded-lg bg-surface flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <Skeleton height="1.25rem" width="40%" />
                <Skeleton height="1rem" width="20%" />
              </div>
              <Skeleton height="3rem" />
              <div className="flex justify-between items-center mt-2">
                <Skeleton height="1rem" width="30%" />
                <Skeleton height="1.5rem" width="15%" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-10 bg-surface border border-border rounded-lg text-center p-6">
          <AlertCircle size={32} className="text-danger mb-2" />
          <h3 className="font-semibold text-ink">Не удалось загрузить шаблоны</h3>
          <p className="text-xs text-muted mb-4">
            Проверьте соединение с сервером или попробуйте еще раз.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Обновить
          </Button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 bg-surface border border-border rounded-lg text-center p-6">
          <Layout size={40} className="text-muted mb-3" />
          <h3 className="font-semibold text-ink">Шаблоны не найдены</h3>
          <p className="text-xs text-muted max-w-sm leading-relaxed">
            Попробуйте сбросить фильтры или создать новый шаблон рассылки для автоматических
            уведомлений.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`group border border-border rounded-lg bg-surface hover:border-brand/40 hover:shadow-sm transition-all duration-200 flex flex-col justify-between p-5 ${
                !template.isActive ? 'opacity-70 bg-surface-soft' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span
                      className="text-[10px] font-mono text-muted truncate uppercase tracking-wider"
                      title={template.templateCode}
                    >
                      {template.templateCode}
                    </span>
                    <h3 className="font-bold text-sm text-ink truncate group-hover:text-brand transition-colors">
                      {template.templateName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {getLangBadge(template.languageCode)}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink border border-border px-2 py-0.5 rounded-sm">
                      {getChannelIcon(template.channelType)}
                      <span className="capitalize text-[10px]">
                        {template.channelType.toLowerCase()}
                      </span>
                    </span>
                  </div>
                </div>

                {template.subject && (
                  <div className="text-xs text-brand font-medium mb-1.5 truncate">
                    Тема: {template.subject}
                  </div>
                )}

                <p className="text-xs text-muted leading-relaxed line-clamp-3 font-mono bg-surface-soft p-3 rounded-md border border-border/40 mb-4 whitespace-pre-wrap">
                  {template.templateBody}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="cursor-pointer"
                    onClick={() => handleToggleActive(template)}
                    title={template.isActive ? 'Деактивировать шаблон' : 'Активировать шаблон'}
                  >
                    {template.isActive ? (
                      <ToggleRight size={32} className="text-brand" />
                    ) : (
                      <ToggleLeft size={32} className="text-muted" />
                    )}
                  </button>
                  <span className="text-[11px] font-medium text-muted">
                    {template.isActive ? 'Активен' : 'Неактивен'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {template.isSystem && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200"
                      title="Этот шаблон поставляется системой и его код/канал нельзя редактировать"
                    >
                      <ShieldCheck size={10} />
                      Системный
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1 text-xs"
                    onClick={() => handleEditClick(template)}
                  >
                    <Edit2 size={12} />
                    <span>Изменить</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Radical Full width Dialog for Template Editor */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader className="border-b pb-2 mb-2">
            <DialogTitle>
              {editingTemplate
                ? 'Параметры шаблона уведомлений'
                : 'Создание нового шаблона для рассылок'}
            </DialogTitle>
            <DialogDescription>
              Настройте параметры макросов, проверьте ограничения по SMS сегментам и оцените
              live-рендеринг.
            </DialogDescription>
          </DialogHeader>
          <TemplateEditor
            template={editingTemplate}
            isSaving={createTemplate.isPending || updateTemplate.isPending}
            onSave={handleSave}
            onCancel={() => {
              setIsEditorOpen(false);
              setEditingTemplate(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
