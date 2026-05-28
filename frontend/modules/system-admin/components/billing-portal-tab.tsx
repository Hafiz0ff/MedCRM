'use client';

import {
  CreditCard,
  BarChart3,
  ShoppingBag,
  Palette,
  Fingerprint,
  Save,
  Upload,
  Check,
  Loader2,
  ExternalLink,
  Shield,
  MessageSquare,
  HardDrive,
  ToggleLeft,
  ToggleRight,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useState, useEffect, FormEvent } from 'react';
import {
  useBillingPlans,
  useBillingUsage,
  useToggleModule,
  useBillingInvoices,
  useSaveBranding,
  useBrandingConfig,
  useSsoConfig,
  useSaveSsoConfig,
  BillingPlan,
  BrandingConfig,
  SsoConfig,
} from '../hooks/use-billing';
import { can } from '@/shared/permissions/can';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { useToast } from '@/shared/ui/toast';

export function BillingPortalTab({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const { toast } = useToast();
  const canManage = can(bootstrap, 'system.settings.manage');

  // Queries & Mutations
  const plansQuery = useBillingPlans();
  const usageQuery = useBillingUsage();
  const invoicesQuery = useBillingInvoices();
  const brandingQuery = useBrandingConfig();
  const ssoQuery = useSsoConfig();

  const toggleModuleMutation = useToggleModule();
  const saveBrandingMutation = useSaveBranding();
  const saveSsoMutation = useSaveSsoConfig();

  // Local state for interactive features
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isUpgradingPlan, setIsUpgradingPlan] = useState<string | null>(null);

  // White-label branding inputs
  const [brandColor, setBrandColor] = useState('220 90% 56%');
  const [accentColor, setAccentColor] = useState('142 70% 45%');
  const [companyName, setCompanyName] = useState('MedCRM Enterprise');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');

  // SSO Form inputs
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [samlMetadataUrl, setSamlMetadataUrl] = useState('');
  const [samlEntityId, setSamlEntityId] = useState('');
  const [oidcClientId, setOidcClientId] = useState('');
  const [oidcClientSecret, setOidcClientSecret] = useState('');
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState('');

  // Sync state values from queries
  useEffect(() => {
    if (brandingQuery.data) {
      setBrandColor(brandingQuery.data.brandColor);
      setAccentColor(brandingQuery.data.accentColor);
      setCompanyName(brandingQuery.data.companyName ?? 'MedCRM Enterprise');
      setLogoUrl(brandingQuery.data.logoUrl ?? '');
      setFaviconUrl(brandingQuery.data.faviconUrl ?? '');
    }
  }, [brandingQuery.data]);

  useEffect(() => {
    if (ssoQuery.data) {
      setSsoEnabled(ssoQuery.data.enabled);
      setSamlMetadataUrl(ssoQuery.data.samlMetadataUrl ?? '');
      setSamlEntityId(ssoQuery.data.samlEntityId ?? '');
      setOidcClientId(ssoQuery.data.oidcClientId ?? '');
      setOidcClientSecret(ssoQuery.data.oidcClientSecret ?? '');
      setOidcIssuerUrl(ssoQuery.data.oidcIssuerUrl ?? '');
    }
  }, [ssoQuery.data]);

  // Handle plan upgrade simulation
  const handleUpgradePlan = (planId: string) => {
    if (!canManage) {
      toast('error', 'Доступ ограничен', 'У вас нет прав администратора для изменения тарифа.');
      return;
    }
    setIsUpgradingPlan(planId);
    setTimeout(() => {
      setIsUpgradingPlan(null);
      setSelectedPlanId(planId);
      toast(
        'success',
        'Тариф изменен',
        `Вы успешно переключились на тарифный план "${planId.toUpperCase()}". Счета обновятся в следующем цикле.`,
      );
    }, 1200);
  };

  // Handle feature marketplace toggle
  const handleFeatureToggle = (moduleCode: string, enabled: boolean) => {
    if (!canManage) {
      toast('error', 'Доступ ограничен', 'У вас нет прав для включения/выключения модулей.');
      return;
    }
    toggleModuleMutation.mutate(
      { moduleCode, enabled },
      {
        onSuccess: () => {
          toast(
            'success',
            enabled ? 'Модуль активирован' : 'Модуль отключен',
            `Модуль ${moduleCode.toUpperCase()} успешно изменен. Настройки биллинга обновлены.`,
          );
        },
        onError: (err: any) => {
          toast('error', 'Ошибка изменения модуля', err.message || 'Пожалуйста, попробуйте позже.');
        },
      },
    );
  };

  // Handle saving brand config
  const handleSaveBranding = (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    saveBrandingMutation.mutate(
      { brandColor, accentColor, companyName, logoUrl, faviconUrl },
      {
        onSuccess: () => {
          toast(
            'success',
            'Брендинг сохранен',
            'Новые цвета и логотипы успешно применены ко всем интерфейсам MedCRM.',
          );
        },
        onError: (err: any) => {
          toast('error', 'Ошибка сохранения брендинга', err.message);
        },
      },
    );
  };

  // Handle saving SSO federation keys
  const handleSaveSso = (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    saveSsoMutation.mutate(
      {
        enabled: ssoEnabled,
        samlMetadataUrl,
        samlEntityId,
        oidcClientId,
        oidcClientSecret,
        oidcIssuerUrl,
      },
      {
        onSuccess: () => {
          toast(
            'success',
            'Настройки SSO сохранены',
            ssoEnabled
              ? 'Авторизация через корпоративный SSO OIDC/SAML включена.'
              : 'Авторизация через SSO отключена.',
          );
        },
        onError: (err: any) => {
          toast('error', 'Ошибка сохранения SSO', err.message);
        },
      },
    );
  };

  // Custom logo png selectors mock triggers
  const handleLogoUpload = (type: 'logo' | 'favicon') => {
    const mockUrls = {
      logo: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=120&h=40&q=80',
      favicon:
        'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=32&h=32&q=80',
    };
    if (type === 'logo') {
      setLogoUrl(mockUrls.logo);
      toast('success', 'Логотип выбран', 'Медицинский логотип загружен во временный буфер.');
    } else {
      setFaviconUrl(mockUrls.favicon);
      toast('success', 'Фавикон выбран', 'Иконка приложения загружена во временный буфер.');
    }
  };

  if (plansQuery.isLoading || usageQuery.isLoading || invoicesQuery.isLoading) {
    return (
      <div className="settings-loading">
        <Loader2 className="spin" size={18} />
        <span>Загружаем биллинг и корпоративные настройки…</span>
      </div>
    );
  }

  const plans = plansQuery.data ?? [];
  const usage = usageQuery.data;
  const invoices = invoicesQuery.data ?? [];

  const currentPlan = selectedPlanId
    ? plans.find((p) => p.id === selectedPlanId)
    : plans.find((p) => p.isCurrent);

  return (
    <div className="settings-grid animate-in fade-in duration-300">
      {/* LEFT COLUMN: Subscriptions & Marketplace */}
      <div className="space-y-6 flex flex-col">
        {/* SUBSCRIPTIONS SECTION */}
        <section className="content-panel relative overflow-hidden bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <div className="panel-header mb-6">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100 font-outfit">
                <CreditCard className="text-brand" size={20} />
                Корпоративная подписка
              </h2>
              <p className="muted text-sm text-slate-400 mt-1">
                Выберите оптимальный тарифный план для вашей сети клиник или одиночной практики.
              </p>
            </div>
            {currentPlan && (
              <span className="px-3 py-1 text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/30 rounded-full uppercase tracking-wider animate-pulse">
                Текущий: {currentPlan.name}
              </span>
            )}
          </div>

          {/* Plan cards list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const isActive = currentPlan?.id === plan.id;
              const isEnterprise = plan.id === 'enterprise';
              return (
                <div
                  key={plan.id}
                  className={`relative p-5 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                    isActive
                      ? 'border-brand bg-brand/5 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                      : 'border-slate-800 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-900/30'
                  }`}
                >
                  {isEnterprise && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-widest">
                      Enterprise Ready
                    </div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-100">{plan.name}</h4>
                      <div className="flex items-baseline gap-1 mt-1 text-2xl font-extrabold text-brand">
                        ${plan.price}
                        <span className="text-xs font-normal text-slate-400 font-sans">
                          /{plan.interval === 'month' ? 'мес' : 'год'}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-300 border-t border-slate-800 pt-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Check className="text-brand shrink-0 mt-0.5" size={13} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 mt-4">
                    <button
                      type="button"
                      onClick={() => handleUpgradePlan(plan.id)}
                      disabled={isActive || isUpgradingPlan !== null}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-brand/20 text-brand border border-brand/30 cursor-default'
                          : 'bg-brand hover:bg-brand-strong text-white font-bold'
                      }`}
                    >
                      {isUpgradingPlan === plan.id ? (
                        <span className="flex items-center justify-center gap-1">
                          <Loader2 size={13} className="spin" /> Активация...
                        </span>
                      ) : isActive ? (
                        'Активный план'
                      ) : (
                        'Выбрать тариф'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invoice history */}
          <div className="mt-8 border-t border-slate-800 pt-6">
            <h3 className="text-sm font-bold text-slate-200 mb-3">История транзакций и счетов</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/20 border border-slate-900 text-xs hover:bg-slate-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-slate-900 text-slate-300">
                      <CreditCard size={14} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">{inv.id}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(inv.date).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-200">${inv.amount.toFixed(2)}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide">
                      {inv.status}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        toast(
                          'success',
                          'Скачивание начато',
                          `Счет ${inv.id} загружается в формате PDF.`,
                        )
                      }
                      className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title="Скачать PDF счет"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURE MARKETPLACE */}
        <section className="content-panel bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <div className="panel-header mb-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100 font-outfit">
                <ShoppingBag className="text-brand" size={20} />
                Маркетплейс микро-фич
              </h2>
              <p className="muted text-sm text-slate-400 mt-1">
                Подключайте и отключайте дополнительные опции на лету. Оплата списывается
                пропорционально дням использования.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                code: 'telehealth',
                name: 'Телемедицина и видеосвязь',
                desc: 'Интегрированные защищенные видеокомнаты для удаленных консультаций пациентов в Full HD с автозаписью.',
                price: '+$29/мес',
                enabled: true,
              },
              {
                code: 'analytics',
                name: 'Продвинутая аналитика',
                desc: 'Дашборды по выручке врачей, заполняемости расписания и конверсии визитов с AI-прогнозированием.',
                price: '+$19/мес',
                enabled: false,
              },
              {
                code: 'fhir-sync',
                name: 'Синхронизация по FHIR стандарту',
                desc: 'Экспорт/импорт медицинских карт пациентов в государственные реестры по защищенному REST API.',
                price: '+$39/мес',
                enabled: true,
              },
              {
                code: 'e-prescriptions',
                name: 'Электронные рецепты',
                desc: 'Выписка рецептов с цифровой подписью врача, валидацией противопоказаний и отправкой в аптеки.',
                price: '+$15/мес',
                enabled: false,
              },
            ].map((module) => {
              const Icon = module.enabled ? ToggleRight : ToggleLeft;
              return (
                <div
                  key={module.code}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                    module.enabled
                      ? 'border-brand/40 bg-brand/5 shadow-xs'
                      : 'border-slate-800 bg-slate-950/20 hover:border-slate-800'
                  }`}
                >
                  <div className="space-y-1 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-slate-200">{module.name}</strong>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 font-mono">
                        {module.price}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{module.desc}</p>
                  </div>

                  <button
                    type="button"
                    className={`settings-toggle text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                      module.enabled ? 'text-brand bg-brand/10' : 'text-slate-400 bg-slate-900/50'
                    }`}
                    onClick={() => handleFeatureToggle(module.code, !module.enabled)}
                    disabled={toggleModuleMutation.isPending}
                  >
                    <Icon size={18} />
                    <span>{module.enabled ? 'Включено' : 'Выключено'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: Usage, Branding, SSO */}
      <div className="space-y-6 flex flex-col">
        {/* USAGE METERS SECTION */}
        <section className="content-panel bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <div className="panel-header mb-6">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100 font-outfit">
                <BarChart3 className="text-brand" size={20} />
                Метрики и лимиты использования
              </h2>
              <p className="muted text-sm text-slate-400 mt-1">
                Фактическое потребление ресурсов клиники по текущему тарифу.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Meter 1: SMS messages */}
            {usage && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <MessageSquare size={14} className="text-brand" />
                      Служебные SMS уведомления
                    </span>
                    <span className="text-slate-100">
                      {usage.smsUsed} / {usage.smsLimit} шт
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950/80 overflow-hidden border border-slate-800/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                      style={{ width: `${(usage.smsUsed / usage.smsLimit) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>
                      Использовано: {((usage.smsUsed / usage.smsLimit) * 100).toFixed(0)}%
                    </span>
                    <span>Обновление 1-го числа</span>
                  </div>
                </div>

                {/* Meter 2: DICOM Storage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <HardDrive size={14} className="text-brand" />
                      DICOM Облачный архив
                    </span>
                    <span className="text-slate-100">
                      {usage.dicomUsedGb} GB / {usage.dicomLimitGb} GB
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950/80 overflow-hidden border border-slate-800/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500"
                      style={{ width: `${(usage.dicomUsedGb / usage.dicomLimitGb) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>
                      Заполнено: {((usage.dicomUsedGb / usage.dicomLimitGb) * 100).toFixed(0)}%
                    </span>
                    <span>Безлимитный авто-архив</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* WHITE-LABEL BRANDING OVERRIDES */}
        <section className="content-panel bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <div className="panel-header mb-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100 font-outfit">
                <Palette className="text-brand" size={20} />
                Белый брендинг (White-Label)
              </h2>
              <p className="muted text-sm text-slate-400 mt-1">
                Кастомизируйте цветовую гамму, название и логотипы MedCRM под корпоративный бренд
                вашей клиники.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveBranding} className="space-y-4">
            <div className="field">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Название медицинской организации
              </label>
              <input
                type="text"
                className="input w-full bg-slate-950/40 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={!canManage}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Основной цвет (HSL Brand)
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded border border-slate-700 shrink-0"
                    style={{ backgroundColor: `hsl(${brandColor})` }}
                  />
                  <input
                    type="text"
                    className="input w-full bg-slate-950/40 border border-slate-800 text-slate-200 text-xs font-mono rounded p-2"
                    placeholder="220 90% 56%"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    disabled={!canManage}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Акцентный цвет (HSL Accent)
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded border border-slate-700 shrink-0"
                    style={{ backgroundColor: `hsl(${accentColor})` }}
                  />
                  <input
                    type="text"
                    className="input w-full bg-slate-950/40 border border-slate-800 text-slate-200 text-xs font-mono rounded p-2"
                    placeholder="142 70% 45%"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={!canManage}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  PNG Логотип (120x40)
                </label>
                <div className="flex flex-col gap-2">
                  {logoUrl ? (
                    <div className="p-2 border border-slate-800 rounded bg-slate-950/50 flex items-center justify-between">
                      <img
                        src={logoUrl}
                        alt="Branding logo preview"
                        className="h-6 object-contain max-w-[80px]"
                      />
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="text-[10px] text-red-400 hover:underline cursor-pointer"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLogoUpload('logo')}
                      disabled={!canManage}
                      className="py-2 px-3 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-500 text-xs flex items-center justify-center gap-1.5 cursor-pointer bg-slate-900/10"
                    >
                      <Upload size={13} />
                      Выбрать PNG файл
                    </button>
                  )}
                </div>
              </div>

              <div className="field">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Favicon Иконка (32x32)
                </label>
                <div className="flex flex-col gap-2">
                  {faviconUrl ? (
                    <div className="p-2 border border-slate-800 rounded bg-slate-950/50 flex items-center justify-between">
                      <img
                        src={faviconUrl}
                        alt="Favicon preview"
                        className="w-5 h-5 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setFaviconUrl('')}
                        className="text-[10px] text-red-400 hover:underline cursor-pointer"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLogoUpload('favicon')}
                      disabled={!canManage}
                      className="py-2 px-3 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-500 text-xs flex items-center justify-center gap-1.5 cursor-pointer bg-slate-900/10"
                    >
                      <Upload size={13} />
                      Выбрать Иконку
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Premium style Brand preview area */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-outfit">
                Интерактивное превью
              </span>
              <div className="flex flex-wrap gap-2">
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: `hsl(${brandColor})` }}
                >
                  Колористика Бренда
                </span>
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-white shadow-xs"
                  style={{ backgroundColor: `hsl(${accentColor})` }}
                >
                  Акцентные триггеры
                </span>
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                  style={{ color: `hsl(${brandColor})`, borderColor: `hsl(${brandColor})` }}
                >
                  Границы кнопок
                </span>
              </div>
            </div>

            {canManage && (
              <div className="page-actions pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saveBrandingMutation.isPending}
                  className="button bg-brand hover:bg-brand-strong text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {saveBrandingMutation.isPending ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {saveBrandingMutation.isPending ? 'Применение…' : 'Применить Брендинг'}
                </button>
              </div>
            )}
          </form>
        </section>

        {/* SSO FEDERATED KEY SETUP */}
        <section className="content-panel bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <div className="panel-header mb-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100 font-outfit">
                <Fingerprint className="text-brand" size={20} />
                Корпоративный SSO (SAML & OIDC)
              </h2>
              <p className="muted text-sm text-slate-400 mt-1">
                Настройте единую точку входа (Single Sign-On) через корпоративные каталоги
                пользователей AD FS, Keycloak, Okta или Azure AD.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSso} className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/20 text-xs">
              <div className="space-y-0.5">
                <strong className="text-slate-200">Включить Федеративный SSO</strong>
                <p className="text-slate-400">
                  Сотрудники смогут авторизоваться одной кнопкой через Intranet.
                </p>
              </div>

              <button
                type="button"
                className={`text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                  ssoEnabled ? 'text-green-400 bg-green-500/10' : 'text-slate-400 bg-slate-800/40'
                }`}
                onClick={() => setSsoEnabled(!ssoEnabled)}
                disabled={!canManage}
              >
                {ssoEnabled ? 'Активирован' : 'Деактивирован'}
              </button>
            </div>

            {ssoEnabled && (
              <div className="space-y-3 p-4 rounded-xl border border-slate-800 bg-slate-950/40 animate-in fade-in duration-300">
                <div className="border-b border-slate-800 pb-2 mb-2">
                  <span className="text-[10px] font-bold text-brand uppercase tracking-wider font-outfit">
                    SAML 2.0 Провайдер
                  </span>
                </div>

                <div className="field">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    SAML XML Метаданные Провайдера (URL)
                  </label>
                  <input
                    type="url"
                    className="input w-full bg-slate-950/40 border border-slate-800 text-slate-200 text-xs font-mono rounded p-2"
                    placeholder="https://idp.mycompany.com/federation/metadata.xml"
                    value={samlMetadataUrl}
                    onChange={(e) => setSamlMetadataUrl(e.target.value)}
                    disabled={!canManage}
                  />
                </div>

                <div className="field">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    SAML SP Entity ID
                  </label>
                  <input
                    type="text"
                    className="input w-full bg-slate-950/40 border border-slate-800 text-slate-200 text-xs font-mono rounded p-2"
                    placeholder="medcrm-sp-entity-id"
                    value={samlEntityId}
                    onChange={(e) => setSamlEntityId(e.target.value)}
                    disabled={!canManage}
                  />
                </div>

                <div className="border-b border-slate-800 pb-2 pt-2 mb-2">
                  <span className="text-[10px] font-bold text-brand uppercase tracking-wider font-outfit">
                    OpenID Connect (OIDC) Клиент
                  </span>
                </div>

                <div className="field">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    OIDC Issuer (Сервер Авторизации)
                  </label>
                  <input
                    type="url"
                    className="input w-full bg-slate-950/40 border border-slate-800 text-slate-200 text-xs font-mono rounded p-2"
                    placeholder="https://auth.company.com/oauth2/default"
                    value={oidcIssuerUrl}
                    onChange={(e) => setOidcIssuerUrl(e.target.value)}
                    disabled={!canManage}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      OIDC Client ID
                    </label>
                    <input
                      type="text"
                      className="input w-full bg-slate-950/40 border border-slate-800 text-slate-200 text-xs font-mono rounded p-2"
                      placeholder="medcrm_client_id"
                      value={oidcClientId}
                      onChange={(e) => setOidcClientId(e.target.value)}
                      disabled={!canManage}
                    />
                  </div>

                  <div className="field">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      OIDC Client Secret
                    </label>
                    <input
                      type="password"
                      className="input w-full bg-slate-950/40 border border-slate-800 text-slate-200 text-xs font-mono rounded p-2"
                      placeholder="••••••••••••••••••••••••••••••••"
                      value={oidcClientSecret}
                      onChange={(e) => setOidcClientSecret(e.target.value)}
                      disabled={!canManage}
                    />
                  </div>
                </div>
              </div>
            )}

            {canManage && (
              <div className="page-actions pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saveSsoMutation.isPending}
                  className="button bg-brand hover:bg-brand-strong text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {saveSsoMutation.isPending ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {saveSsoMutation.isPending ? 'Сохранение…' : 'Сохранить SSO'}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
