'use client';

import {
  Clock,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  Edit,
  Settings,
  HelpCircle,
  AlertCircle,
  MessageCircle,
  MessageSquare,
  Mail,
  Save,
  Key,
  ShieldCheck,
  CheckCircle,
  Info,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  useNotificationRules,
  useCreateNotificationRule,
  useUpdateNotificationRule,
  useDeleteNotificationRule,
  useTemplates,
  useChannels,
  useConfigureChannel,
  useSmsProviders,
  useConfigureSmsProvider,
  NotificationRule,
} from '../hooks/use-communications';
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

export function RulesPage() {
  const { toast } = useToast();
  const { data: rules, isLoading: rulesLoading, isError: rulesError } = useNotificationRules();
  const { data: templates } = useTemplates();
  const { data: channels, refetch: refetchChannels } = useChannels();
  const { data: smsProviders, refetch: refetchSms } = useSmsProviders();

  const createRule = useCreateNotificationRule();
  const updateRule = useUpdateNotificationRule();
  const deleteRule = useDeleteNotificationRule();
  const configureChannel = useConfigureChannel();
  const configureSms = useConfigureSmsProvider();

  // Rule dialog state
  const [isRuleOpen, setIsRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);

  // Rule form fields
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('appointment.scheduled_scan');
  const [ruleChannel, setRuleChannel] = useState('TELEGRAM');
  const [ruleTemplateId, setRuleTemplateId] = useState('');
  const [delayMinutes, setDelayMinutes] = useState(0);

  // Provider configuration fields
  const activeTelegram = channels?.find((c) => c.channelType === 'TELEGRAM');
  const [tgToken, setTgToken] = useState(activeTelegram?.configurationJson?.token || '');
  const [tgUsername, setTgUsername] = useState(activeTelegram?.configurationJson?.username || '');
  const [isSavingTg, setIsSavingTg] = useState(false);

  const activeSms = smsProviders?.find((p) => p.isActive) || smsProviders?.[0];
  const [smsProviderCode, setSmsProviderCode] = useState(activeSms?.providerCode || 'OSON_SMS');
  const [smsProviderName, setSmsProviderName] = useState(activeSms?.providerName || 'Oson SMS');
  const [smsSenderName, setSmsSenderName] = useState(activeSms?.senderName || 'MedCRM');
  const [smsApiKey, setSmsApiKey] = useState(activeSms?.apiCredentialsJson?.apiKey || '');
  const [smsSecret, setSmsSecret] = useState(activeSms?.apiCredentialsJson?.secret || '');
  const [smsDailyLimit, setSmsDailyLimit] = useState(activeSms?.dailyLimit || 1000);
  const [isSavingSms, setIsSavingSms] = useState(false);

  React.useEffect(() => {
    if (activeTelegram) {
      setTgToken(activeTelegram.configurationJson?.token || '');
      setTgUsername(activeTelegram.configurationJson?.username || '');
    }
  }, [activeTelegram]);

  React.useEffect(() => {
    if (activeSms) {
      setSmsProviderCode(activeSms.providerCode);
      setSmsProviderName(activeSms.providerName);
      setSmsSenderName(activeSms.senderName);
      setSmsApiKey(activeSms.apiCredentialsJson?.apiKey || '');
      setSmsSecret(activeSms.apiCredentialsJson?.secret || '');
      setSmsDailyLimit(activeSms.dailyLimit);
    }
  }, [activeSms]);

  const handleEditClick = (rule: NotificationRule) => {
    setEditingRule(rule);
    setRuleName(rule.ruleName);
    setTriggerEvent(rule.triggerEvent);
    setRuleChannel(rule.channelType);
    setRuleTemplateId(rule.templateId);
    setDelayMinutes(rule.delayMinutes);
    setIsRuleOpen(true);
  };

  const handleCreateClick = () => {
    setEditingRule(null);
    setRuleName('');
    setTriggerEvent('appointment.scheduled_scan');
    setRuleChannel('TELEGRAM');
    setRuleTemplateId(templates?.[0]?.id || '');
    setDelayMinutes(0);
    setIsRuleOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !ruleTemplateId) return;

    try {
      if (editingRule) {
        await updateRule.mutateAsync({
          id: editingRule.id,
          ruleName,
          templateId: ruleTemplateId,
          delayMinutes,
        });
        toast('success', 'Правило обновлено', `Правило "${ruleName}" успешно изменено`);
      } else {
        await createRule.mutateAsync({
          ruleName,
          triggerEvent,
          channelType: ruleChannel,
          templateId: ruleTemplateId,
          delayMinutes,
          conditionsJson: {},
        });
        toast('success', 'Правило создано', `Правило "${ruleName}" успешно добавлено`);
      }
      setIsRuleOpen(false);
    } catch (e: any) {
      toast('error', 'Ошибка', e.message || 'Не удалось сохранить правило');
    }
  };

  const handleToggleActive = async (rule: NotificationRule) => {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        isActive: !rule.isActive,
      });
      toast(
        'success',
        'Статус правила изменен',
        `Правило "${rule.ruleName}" теперь ${!rule.isActive ? 'активно' : 'отключено'}`,
      );
    } catch (e: any) {
      toast('error', 'Ошибка', e.message || 'Не удалось обновить статус правила');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Вы действительно хотите удалить это правило уведомления?')) return;
    try {
      await deleteRule.mutateAsync(id);
      toast('success', 'Правило удалено', 'Настройка расписания очищена');
    } catch (e: any) {
      toast('error', 'Ошибка', e.message || 'Не удалось удалить правило');
    }
  };

  const handleSaveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgToken || !tgUsername) return;
    setIsSavingTg(true);
    try {
      await configureChannel.mutateAsync({
        channelType: 'TELEGRAM',
        providerCode: 'TELEGRAM_BOT',
        configurationJson: { token: tgToken, username: tgUsername },
        isActive: true,
      });
      toast('success', 'Бот Telegram настроен', 'Ключ успешно сохранен в базе');
      refetchChannels();
    } catch (e: any) {
      toast('error', 'Ошибка настройки', e.message || 'Не удалось сохранить конфигурацию');
    } finally {
      setIsSavingTg(false);
    }
  };

  const handleSaveSmsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSms(true);
    try {
      await configureSms.mutateAsync({
        providerCode: smsProviderCode,
        providerName: smsProviderName,
        senderName: smsSenderName,
        apiCredentialsJson: { apiKey: smsApiKey, secret: smsSecret },
        dailyLimit: Number(smsDailyLimit),
        isActive: true,
      });
      toast('success', 'SMS Провайдер сохранен', 'Настройки SMS-шлюза обновлены');
      refetchSms();
    } catch (e: any) {
      toast('error', 'Ошибка настройки', e.message || 'Не удалось настроить SMS шлюз');
    } finally {
      setIsSavingSms(false);
    }
  };

  const getTriggerLabel = (event: string) => {
    switch (event) {
      case 'appointment.scheduled_scan':
        return 'Сканер расписания (24h/2h напоминания)';
      case 'appointment.created':
        return 'При создании визита (сразу)';
      case 'appointment.no-show':
        return 'При неявке пациента (через 30 мин)';
      case 'invoice.created':
        return 'Выставление счета';
      default:
        return event;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* SECTION 1: Rules & Schedules */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Сценарии автоматизации рассылок</h2>
            <p className="text-xs text-muted">
              Управляйте триггерами, задержками и шаблонами для автоматических коммуникаций.
            </p>
          </div>
          <Button onClick={handleCreateClick} className="flex items-center gap-1.5">
            <Plus size={16} />
            <span>Добавить правило</span>
          </Button>
        </div>

        {rulesLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton height="3rem" />
            <Skeleton height="3rem" />
            <Skeleton height="3rem" />
          </div>
        ) : rulesError ? (
          <div className="flex items-center gap-2 bg-danger-soft p-4 rounded-md border border-danger/10 text-danger-strong text-xs">
            <AlertCircle size={16} />
            <span>Не удалось загрузить правила. Проверьте соединение с БД.</span>
          </div>
        ) : rules?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-surface border border-border rounded-lg text-center p-6">
            <Clock size={36} className="text-muted mb-2" />
            <h3 className="font-semibold text-ink">Правила автоматизации не настроены</h3>
            <p className="text-xs text-muted max-w-sm">
              Добавьте первое правило, например, автоматическую отправку СМС-напоминания за 24 часа.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-border rounded-lg bg-surface">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-soft border-b border-border text-muted font-semibold uppercase tracking-wider">
                  <th className="p-3">Название</th>
                  <th className="p-3">Событие-триггер</th>
                  <th className="p-3">Канал</th>
                  <th className="p-3">Задержка</th>
                  <th className="p-3">Шаблон сообщения</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rules?.map((rule) => (
                  <tr key={rule.id} className="hover:bg-surface-soft/40 transition-colors">
                    <td className="p-3 font-semibold text-ink">{rule.ruleName}</td>
                    <td className="p-3 font-medium text-brand">
                      {getTriggerLabel(rule.triggerEvent)}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-ink">
                        {rule.channelType === 'TELEGRAM' ? (
                          <MessageCircle size={12} className="text-sky-500" />
                        ) : rule.channelType === 'SMS' ? (
                          <MessageSquare size={12} className="text-emerald-500" />
                        ) : (
                          <Mail size={12} className="text-indigo-500" />
                        )}
                        {rule.channelType}
                      </span>
                    </td>
                    <td className="p-3 font-mono">
                      {rule.delayMinutes === 0 ? 'Без задержки' : `${rule.delayMinutes} мин`}
                    </td>
                    <td className="p-3 text-muted truncate max-w-[180px]">
                      {rule.template?.templateName || `Шаблон ID: ${rule.templateId}`}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="cursor-pointer flex items-center gap-1.5 text-xs text-ink"
                        onClick={() => handleToggleActive(rule)}
                      >
                        {rule.isActive ? (
                          <ToggleRight size={26} className="text-brand" />
                        ) : (
                          <ToggleLeft size={26} className="text-muted" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditClick(rule)}
                          className="p-1 hover:text-brand text-muted transition-colors cursor-pointer"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 hover:text-danger text-muted transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: Integrations & Providers credentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
        {/* Telegram Bot Setup */}
        <form
          onSubmit={handleSaveTelegramConfig}
          className="bg-surface border border-border p-5 rounded-lg flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="text-sky-500 shrink-0" size={20} />
            <div>
              <h3 className="text-sm font-bold text-ink">Интеграция с ботом Telegram</h3>
              <p className="text-[11px] text-muted">
                Задайте токен для прямой отправки и приёма команд (/yes, /no)
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted" htmlFor="tgUsername">
              Username бота (без @)
            </label>
            <input
              id="tgUsername"
              required
              className="px-3 py-1.5 text-xs border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-sky-500"
              placeholder="e.g. MedCrmNotificationBot"
              value={tgUsername}
              onChange={(e) => setTgUsername(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted" htmlFor="tgToken">
              API Bot Token
            </label>
            <input
              id="tgToken"
              type="password"
              required
              className="px-3 py-1.5 text-xs font-mono border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-sky-500"
              placeholder="e.g. 1234567890:ABCdefGhIJKlmNoPQRsTUVwXyz"
              value={tgToken}
              onChange={(e) => setTgToken(e.target.value)}
            />
          </div>

          {activeTelegram && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-sm self-start border border-emerald-100">
              <CheckCircle size={10} />
              <span>Соединение настроено</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSavingTg || !tgToken || !tgUsername}
            className="self-end flex items-center gap-1 text-xs"
          >
            <Save size={12} />
            <span>{isSavingTg ? 'Сохранение...' : 'Сохранить токен'}</span>
          </Button>
        </form>

        {/* SMS Gateway Setup */}
        <form
          onSubmit={handleSaveSmsConfig}
          className="bg-surface border border-border p-5 rounded-lg flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="text-emerald-500 shrink-0" size={20} />
            <div>
              <h3 className="text-sm font-bold text-ink">Шлюз SMS сообщений</h3>
              <p className="text-[11px] text-muted">
                Настройки локальных провайдеров Таджикистана для надежной СМС дистрибуции
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted" htmlFor="smsProvider">
                Шлюз (Интеграция)
              </label>
              <select
                id="smsProvider"
                className="px-3 py-1.5 text-xs border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                value={smsProviderCode}
                onChange={(e) => {
                  setSmsProviderCode(e.target.value);
                  const names: Record<string, string> = {
                    OSON_SMS: 'Oson SMS',
                    BABILON_T: 'Babilon-T TCP',
                    TCELL: 'Tcell SMPP',
                    MEGAFON_TJ: 'Megafon U-SMS',
                  };
                  setSmsProviderName(names[e.target.value] || e.target.value);
                }}
              >
                <option value="OSON_SMS">Oson SMS (HTTP)</option>
                <option value="BABILON_T">Babilon-T (TCP/XML)</option>
                <option value="TCELL">Tcell (SMPP Relay)</option>
                <option value="MEGAFON_TJ">Megafon TJ (U-SMS)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted" htmlFor="smsSender">
                Имя отправителя (Sender ID)
              </label>
              <input
                id="smsSender"
                required
                className="px-3 py-1.5 text-xs border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-emerald-500"
                placeholder="e.g. MedCRM / SHIFO"
                value={smsSenderName}
                onChange={(e) => setSmsSenderName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted" htmlFor="smsApiKey">
                API Key / Логин
              </label>
              <input
                id="smsApiKey"
                required
                className="px-3 py-1.5 text-xs font-mono border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-emerald-500"
                placeholder="Логин или токен API"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted" htmlFor="smsSecret">
                Секретный ключ / Пароль
              </label>
              <input
                id="smsSecret"
                type="password"
                className="px-3 py-1.5 text-xs font-mono border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-emerald-500"
                placeholder="Секрет (если требуется)"
                value={smsSecret}
                onChange={(e) => setSmsSecret(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted" htmlFor="smsLimit">
              Суточный лимит сообщений
            </label>
            <input
              id="smsLimit"
              type="number"
              required
              className="px-3 py-1.5 text-xs border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-emerald-500"
              placeholder="1000"
              value={smsDailyLimit}
              onChange={(e) => setSmsDailyLimit(Number(e.target.value))}
            />
          </div>

          <Button
            type="submit"
            disabled={isSavingSms || !smsSenderName || !smsApiKey}
            className="self-end flex items-center gap-1 text-xs"
          >
            <Save size={12} />
            <span>{isSavingSms ? 'Настройка...' : 'Подключить шлюз'}</span>
          </Button>
        </form>
      </div>

      {/* SECTION 3: Quiet Hours Setting Info */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-5 flex items-start gap-4">
        <Info className="text-indigo-600 shrink-0 mt-0.5" size={22} />
        <div className="flex flex-col gap-1 text-xs leading-relaxed text-indigo-950">
          <span className="font-bold text-sm">Правило "Quiet Hours" (Тихий режим)</span>
          <p className="text-muted">
            В соответствии с нормативными правилами защиты приватности, все автоматические SMS и
            мессенджер уведомления приостанавливаются в период с **22:00 до 08:00** (по местному
            часовому поясу филиала клиники). Запланированные на это время сообщения автоматически
            переносятся на **08:30 утра**.
          </p>
          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-sm self-start mt-1">
            ⚙️ Режим активен автоматически для всех каналов связи кроме EMR-сигнатур
          </span>
        </div>
      </div>

      {/* Rule Creation / Edition dialog wrapper */}
      <Dialog open={isRuleOpen} onOpenChange={setIsRuleOpen}>
        <DialogContent className="max-w-md w-[90vw]">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Настройка расписания рассылки' : 'Новый автоматизированный сценарий'}
            </DialogTitle>
            <DialogDescription>
              Задайте триггер, временной интервал задержки и свяжите его с шаблоном сообщения.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRule} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted" htmlFor="rName">
                Название сценария
              </label>
              <input
                id="rName"
                required
                className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand"
                placeholder="e.g. SMS напоминание за 24ч"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
            </div>

            {!editingRule && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted" htmlFor="rTrigger">
                    Событие-триггер
                  </label>
                  <select
                    id="rTrigger"
                    className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden"
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value)}
                  >
                    <option value="appointment.scheduled_scan">
                      Напоминание о записи (24ч/2ч сканер)
                    </option>
                    <option value="appointment.created">При создании записи (сразу)</option>
                    <option value="appointment.no-show">
                      При неявке пациента (через 30 минут)
                    </option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted" htmlFor="rChannel">
                    Канал доставки
                  </label>
                  <select
                    id="rChannel"
                    className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden"
                    value={ruleChannel}
                    onChange={(e) => setRuleChannel(e.target.value)}
                  >
                    <option value="TELEGRAM">Telegram</option>
                    <option value="SMS">SMS-сообщение</option>
                    <option value="EMAIL">Email-письмо</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted" htmlFor="rTemplate">
                Шаблон для отправки
              </label>
              <select
                id="rTemplate"
                required
                className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand cursor-pointer"
                value={ruleTemplateId}
                onChange={(e) => setRuleTemplateId(e.target.value)}
              >
                <option value="">Выберите шаблон...</option>
                {templates
                  ?.filter(
                    (t) =>
                      t.isActive &&
                      (editingRule
                        ? t.channelType === editingRule.channelType
                        : t.channelType === ruleChannel),
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.templateName} ({t.languageCode.toUpperCase()})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted" htmlFor="rDelay">
                Задержка триггера (в минутах)
              </label>
              <input
                id="rDelay"
                type="number"
                min={0}
                required
                className="px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink focus:outline-hidden focus:border-brand"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
              />
              <span className="text-[10px] text-muted">
                0 означает моментальную отправку по событию. Для напоминаний о визитах управляется
                сканером.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 pt-2 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setIsRuleOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={!ruleName || !ruleTemplateId}>
                Сохранить сценарий
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
