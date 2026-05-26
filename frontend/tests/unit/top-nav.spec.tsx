import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TopNav } from '@/modules/shell/components/top-nav';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import type { BootstrapPayload } from '@/shared/types/bootstrap';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href?.toString()} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/dashboard',
}));

const bootstrap: BootstrapPayload = {
  tenant: {
    id: 'tenant-demo',
    code: 'demo-clinic',
    name: 'Клиника ВитаПлюс',
    locale: 'ru',
    subscriptionPlan: 'Premium',
  },
  enabledModules: [
    'auth',
    'receptionist-workplace',
    'smart-scheduling',
    'patient-crm',
    'finance-billing',
  ],
  permissions: [
    'auth.bootstrap.read',
    'reception.dashboard.read',
    'scheduling.calendar.read',
    'patients.read',
    'finance.invoice.read',
    'system.settings.read',
  ],
  branches: [{ id: 'branch-main', code: 'main', name: 'Главный филиал' }],
  featureFlags: {},
};

describe('TopNav', () => {
  it('renders the workspace controls from the migrated Lovable shell', () => {
    render(
      <ThemeProvider>
        <TopNav bootstrap={bootstrap} />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText('Глобальный поиск')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Включить тёмную тему' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Уведомления' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Профиль администратора' })).toBeInTheDocument();
    expect(screen.getByText('Главный филиал')).toBeInTheDocument();
  });
});
