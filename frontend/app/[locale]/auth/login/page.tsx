import { useTranslations } from 'next-intl';
import { LoginForm } from '@/modules/auth/components/login-form';
import { AppearanceSelector } from '@/shared/ui/appearance-selector';

export default function LoginPage() {
  const t = useTranslations('Auth');

  return (
    <main className="auth-page relative min-h-screen">
      {/* Floating Appearance Controls */}
      <div className="absolute top-4 right-4 z-50">
        <AppearanceSelector />
      </div>

      <section className="auth-visual">
        <div className="auth-brand">
          <span className="brand-mark">M</span>
          <span>MedCRM</span>
        </div>
        <div className="auth-copy">
          <h1>Рабочая система для частной клиники</h1>
          <p>
            Пациенты, расписание, регистратура и операционный контроль в одном защищенном
            пространстве.
          </p>
        </div>
        <div className="auth-metrics" aria-label="Ключевые возможности">
          <div className="auth-metric">
            <strong>CRM</strong>
            <span>карточки пациентов</span>
          </div>
          <div className="auth-metric">
            <strong>Live</strong>
            <span>статусы визитов</span>
          </div>
          <div className="auth-metric">
            <strong>RBAC</strong>
            <span>доступ по ролям</span>
          </div>
        </div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-panel">
          <span className="eyebrow">{t('title')}</span>
          <h2>Откройте смену клиники</h2>
          <div className="muted">{t('subtitle')}</div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
