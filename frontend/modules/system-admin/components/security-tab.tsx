'use client';

import {
  Shield,
  ShieldAlert,
  Key,
  Smartphone,
  Trash2,
  Download,
  Copy,
  Check,
  LogOut,
  Loader2,
  Info,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/shared/api/client-api';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Input } from '@/shared/ui/input';
import { useToast } from '@/shared/ui/toast';

type ActiveSession = {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: string;
  createdAt: string;
};

export function SecurityTab({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const { toast } = useToast();

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);

  // 2FA Setup state
  const [setupStep, setSetupStep] = useState<'idle' | 'scanning' | 'success'>('idle');
  const [qrCodeUri, setQrCodeUri] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [submitting2fa, setSubmitting2fa] = useState(false);

  // Disable 2FA state
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  // Revocation dialog states
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [revokingAllOthers, setRevokingAllOthers] = useState(false);

  useEffect(() => {
    fetchMfaStatus();
    fetchActiveSessions();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await apiFetch<{ isEnabled: boolean }>('/auth/2fa/status');
      setMfaEnabled(res.isEnabled);
    } catch (err: any) {
      console.error('Failed to fetch 2FA status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      setLoadingSessions(true);
      const data = await apiFetch<ActiveSession[]>('/auth/sessions');
      setSessions(data);
    } catch (err: any) {
      console.error('Failed to fetch active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleStartSetup = async () => {
    try {
      setSubmitting2fa(true);
      const res = await apiFetch<{ secret: string; qrCodeUri: string }>('/auth/2fa/enable', {
        method: 'POST',
      });
      setSecretKey(res.secret);
      setQrCodeUri(res.qrCodeUri);
      setSetupStep('scanning');
    } catch (err: any) {
      toast(
        'error',
        'Ошибка настройки 2FA',
        err.message || 'Не удалось инициализировать настройку.',
      );
    } finally {
      setSubmitting2fa(false);
    }
  };

  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      toast('warning', 'Некорректный код', 'Введите 6-значный код из приложения аутентификатора.');
      return;
    }
    try {
      setSubmitting2fa(true);
      const res = await apiFetch<{ success: boolean; backupCodes: string[] }>('/auth/2fa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: verificationCode }),
      });
      if (res.success) {
        setBackupCodes(res.backupCodes);
        setMfaEnabled(true);
        setSetupStep('success');
        toast('success', '2FA успешно включена!', 'Сохраните резервные коды восстановления.');
      }
    } catch (err: any) {
      toast('error', 'Неверный код', err.message || 'Код аутентификатора не совпадает.');
    } finally {
      setSubmitting2fa(false);
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disableCode.length !== 6) {
      toast('warning', 'Некорректный код', 'Введите 6-значный код подтверждения.');
      return;
    }
    try {
      setSubmitting2fa(true);
      const res = await apiFetch<{ success: boolean }>('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ code: disableCode }),
      });
      if (res.success) {
        setMfaEnabled(false);
        setDisablingMfa(false);
        setDisableCode('');
        toast(
          'success',
          '2FA отключена',
          'Двухфакторная аутентификация отключена для вашего аккаунта.',
        );
      }
    } catch (err: any) {
      toast(
        'error',
        'Ошибка отключения',
        err.message || 'Не удалось отключить 2FA. Проверьте код.',
      );
    } finally {
      setSubmitting2fa(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedSecret(true);
    toast('success', 'Скопировано', 'Секретный ключ скопирован в буфер обмена.');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    const text =
      `РЕЗЕРВНЫЕ КОДЫ ВОССТАНОВЛЕНИЯ MedCRM\nДата: ${new Date().toLocaleDateString()}\nСохраняйте в надежном месте! Каждый код можно использовать один раз.\n\n` +
      backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medcrm-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast('success', 'Файл сохранен', 'Резервные коды сохранены в текстовый файл.');
  };

  const handleRevokeSession = async () => {
    if (!sessionToRevoke) return;
    try {
      await apiFetch(`/auth/sessions/${sessionToRevoke}`, { method: 'DELETE' });
      toast('success', 'Сессия завершена', 'Устройство успешно отключено.');
      setSessions((prev) => prev.filter((s) => s.id !== sessionToRevoke));
    } catch (err: any) {
      toast('error', 'Ошибка завершения сессии', err.message || 'Не удалось завершить сессию.');
    } finally {
      setSessionToRevoke(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    try {
      await apiFetch('/auth/sessions/revoke-all', { method: 'POST' });
      toast('success', 'Все сессии завершены', 'Все другие активные устройства были отключены.');
      fetchActiveSessions();
    } catch (err: any) {
      toast('error', 'Ошибка', err.message || 'Не удалось завершить другие сессии.');
    } finally {
      setRevokingAllOthers(false);
    }
  };

  // Helper to parse user agent into a nice label
  const parseUserAgent = (ua: string | null) => {
    if (!ua) return 'Неизвестное устройство';
    const parsed = ua.toLowerCase();

    let os = 'Неизвестная ОС';
    if (parsed.includes('windows')) os = 'Windows';
    else if (parsed.includes('macintosh') || parsed.includes('mac os')) os = 'macOS';
    else if (parsed.includes('iphone') || parsed.includes('ipad')) os = 'iOS';
    else if (parsed.includes('android')) os = 'Android';
    else if (parsed.includes('linux')) os = 'Linux';

    let browser = 'Неизвестный браузер';
    if (parsed.includes('chrome') || parsed.includes('chromium')) browser = 'Chrome';
    else if (parsed.includes('firefox')) browser = 'Firefox';
    else if (parsed.includes('safari') && !parsed.includes('chrome')) browser = 'Safari';
    else if (parsed.includes('edge')) browser = 'Edge';
    else if (parsed.includes('opera')) browser = 'Opera';

    return `${browser} на ${os}`;
  };

  return (
    <div className="settings-grid">
      {/* 2FA Configuration Panel */}
      <section className="content-panel">
        <div className="panel-header">
          <div>
            <h2>
              <Shield className={mfaEnabled ? 'text-green-500' : 'text-muted'} size={18} />
              Двухфакторная аутентификация (2FA)
            </h2>
            <p className="muted">
              Дополнительный уровень защиты аккаунта от несанкционированного доступа.
            </p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="flex items-center justify-center p-8 text-muted">
            <Loader2 className="animate-spin mr-2" size={18} />
            <span>Проверка статуса 2FA...</span>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Status Display */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-surface-muted/30 border border-border/60">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${mfaEnabled ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}
                >
                  {mfaEnabled ? <Shield size={20} /> : <ShieldAlert size={20} />}
                </div>
                <div>
                  <h4 className="font-semibold text-sm">
                    Статус: {mfaEnabled ? 'Защищено (2FA включена)' : 'Незащищено'}
                  </h4>
                  <p className="text-xs text-muted">
                    {mfaEnabled
                      ? 'Вход в аккаунт требует ввода одноразового пароля из приложения.'
                      : 'Ваш аккаунт защищен только стандартным паролем.'}
                  </p>
                </div>
              </div>

              {!mfaEnabled && setupStep === 'idle' && (
                <Button onClick={handleStartSetup} disabled={submitting2fa}>
                  {submitting2fa ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={14} />
                      Начало...
                    </>
                  ) : (
                    'Включить 2FA'
                  )}
                </Button>
              )}

              {mfaEnabled && !disablingMfa && (
                <Button variant="destructive" onClick={() => setDisablingMfa(true)}>
                  Отключить 2FA
                </Button>
              )}
            </div>

            {/* 2FA SETUP FLOW */}
            {setupStep === 'scanning' && (
              <div className="border border-border/80 rounded-xl p-5 bg-surface-muted/20 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-4">
                  <span className="flex items-center justify-center bg-brand text-white w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">Сканирование QR-кода</h4>
                    <p className="text-xs text-muted">
                      Откройте приложение Authenticator (Google Authenticator, Microsoft
                      Authenticator или Duo) и отсканируйте код ниже.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-center justify-center p-4 bg-surface rounded-lg border border-border/40">
                  {qrCodeUri && (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180&data=${encodeURIComponent(qrCodeUri)}`}
                      alt="QR Code for 2FA"
                      className="w-[180px] h-[180px] object-contain shadow-sm border border-border/10 rounded-md"
                    />
                  )}
                  <div className="space-y-3 max-w-[280px]">
                    <div className="text-xs text-muted">
                      Если вы не можете отсканировать QR-код, введите секретный ключ вручную в вашем
                      приложении:
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-md bg-surface-muted border border-border/50 text-xs font-mono select-all">
                      <span className="truncate flex-1">{secretKey}</span>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="text-brand hover:text-brand-strong cursor-pointer"
                        title="Скопировать"
                      >
                        {copiedSecret ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4 space-y-4">
                  <div className="flex items-start gap-4">
                    <span className="flex items-center justify-center bg-brand text-white w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">Подтверждение кода</h4>
                      <p className="text-xs text-muted font-medium text-brand">
                        Введите 6-значный одноразовый код, сгенерированный в вашем приложении:
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleConfirmSetup} className="flex gap-3 max-w-[340px] pl-10">
                    <Input
                      placeholder="000 000"
                      value={verificationCode}
                      onChange={(e) =>
                        setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      maxLength={6}
                      className="text-center font-mono tracking-widest text-lg h-10"
                      required
                    />
                    <Button type="submit" disabled={submitting2fa} className="shrink-0 h-10">
                      {submitting2fa ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        'Подтвердить'
                      )}
                    </Button>
                  </form>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/40 pl-10">
                  <Button variant="ghost" onClick={() => setSetupStep('idle')} className="text-xs">
                    Отмена
                  </Button>
                </div>
              </div>
            )}

            {/* SETUP SUCCESS & BACKUP CODES VIEW */}
            {setupStep === 'success' && (
              <div className="border border-green-500/20 rounded-xl p-5 bg-green-500/5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-1 bg-green-500/10 text-green-500 rounded-full">
                    <Check size={18} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-green-700 dark:text-green-400">
                      Двухфакторная защита активна!
                    </h4>
                    <p className="text-xs text-muted">
                      Настройка завершена успешно. Пожалуйста, сохраните резервные коды.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-surface border border-border space-y-4 shadow-xs">
                  <div className="flex items-start gap-3 text-xs text-amber-600 dark:text-amber-400">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <span>
                      <strong>Важно:</strong> Резервные коды используются для входа, если у вас не
                      будет доступа к приложению аутентификатора. Каждый код можно применить только
                      один раз. Сохраните их в безопасном и надежном месте.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-w-[320px] mx-auto font-mono text-center text-sm py-2">
                    {backupCodes.map((code) => (
                      <div
                        key={code}
                        className="p-1.5 bg-surface-muted/50 rounded border border-border/40 font-semibold tracking-wide"
                      >
                        {code}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={handleDownloadBackupCodes}>
                      <Download size={14} className="mr-1" />
                      Скачать (.txt)
                    </Button>
                    <Button size="sm" onClick={() => setSetupStep('idle')}>
                      Я сохранил коды
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* DISABLING MFA PROMPT */}
            {disablingMfa && (
              <form
                onSubmit={handleDisableMfa}
                className="border border-danger/20 rounded-xl p-5 bg-danger/5 space-y-4 animate-in fade-in duration-300"
              >
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-danger/90">
                    Отключение двухфакторной защиты
                  </h4>
                  <p className="text-xs text-muted">
                    Для подтверждения отключения 2FA введите текущий 6-значный код из вашего
                    приложения аутентификатора:
                  </p>
                </div>

                <div className="flex gap-3 max-w-[340px]">
                  <Input
                    placeholder="000 000"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="text-center font-mono tracking-widest text-lg h-10"
                    required
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={submitting2fa}
                    className="shrink-0 h-10"
                  >
                    {submitting2fa ? <Loader2 className="animate-spin" size={16} /> : 'Отключить'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDisablingMfa(false);
                      setDisableCode('');
                    }}
                    className="h-10"
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {/* Active Sessions Panel */}
      <section className="content-panel">
        <div className="panel-header flex justify-between items-start">
          <div>
            <h2>
              <Smartphone size={18} className="text-muted" /> Активные сессии устройств
            </h2>
            <p className="muted">Устройства и браузеры, вошедшие в ваш аккаунт MedCRM.</p>
          </div>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs cursor-pointer border-danger/40 text-danger hover:bg-danger/5"
              onClick={() => setRevokingAllOthers(true)}
            >
              <LogOut size={13} className="mr-1" />
              Выйти на всех остальных устройствах
            </Button>
          )}
        </div>

        {loadingSessions ? (
          <div className="flex items-center justify-center p-8 text-muted">
            <Loader2 className="animate-spin mr-2" size={18} />
            <span>Загрузка сессий...</span>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {sessions.map((session, index) => {
              const isCurrent = index === 0; // The first session returned in sorted order is typically the active one
              return (
                <div
                  key={session.id}
                  className={`flex items-center justify-between p-3.5 rounded-lg border text-sm transition-all duration-200 ${
                    isCurrent
                      ? 'border-brand/40 bg-brand/5 shadow-xs'
                      : 'border-border/60 hover:bg-surface-soft/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-md ${isCurrent ? 'bg-brand/10 text-brand' : 'bg-surface-muted text-muted'}`}
                    >
                      <Smartphone size={18} />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {session.deviceName || parseUserAgent(session.userAgent)}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand text-white uppercase tracking-wider">
                            Текущая
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span>
                          IP: <code>{session.ipAddress || '127.0.0.1'}</code>
                        </span>
                        <span>•</span>
                        <span>
                          Активность: {new Date(session.lastActivityAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => setSessionToRevoke(session.id)}
                      className="p-1.5 rounded-md hover:bg-danger/10 hover:text-danger text-muted transition-colors cursor-pointer"
                      title="Завершить сессию"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}

            {sessions.length === 0 && (
              <div className="p-8 text-center text-muted text-sm">Нет активных сессий</div>
            )}
          </div>
        )}
      </section>

      {/* Revoke confirmation dialog */}
      <ConfirmDialog
        open={sessionToRevoke !== null}
        title="Завершить сессию устройства?"
        message="Это приведет к немедленному выходу из аккаунта на выбранном устройстве. Все несохраненные данные будут утеряны."
        confirmLabel="Завершить сессию"
        cancelLabel="Отмена"
        variant="danger"
        onConfirm={handleRevokeSession}
        onCancel={() => setSessionToRevoke(null)}
      />

      {/* Revoke all others confirmation dialog */}
      <ConfirmDialog
        open={revokingAllOthers}
        title="Выйти на всех остальных устройствах?"
        message="Вы будете разлогинены на всех других компьютерах, телефонах и планшетах. Ваша текущая сессия останется активной."
        confirmLabel="Завершить все сессии"
        cancelLabel="Отмена"
        variant="danger"
        onConfirm={handleRevokeAllOthers}
        onCancel={() => setRevokingAllOthers(false)}
      />
    </div>
  );
}
